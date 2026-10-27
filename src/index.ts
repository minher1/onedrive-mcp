#!/usr/bin/env node
/**
 * onedrive-mcp — MCP server for reading OneDrive files into Bob
 *
 * Tools exposed:
 *   onedrive_list   — list files/folders at a OneDrive path
 *   onedrive_read   — read text content of a file (docx, xlsx, txt, md, json, etc.)
 *   onedrive_search — search for files by name across OneDrive
 *
 * Auth: Microsoft OAuth (device code flow) via @azure/msal-node
 * Tokens are cached to ~/.onedrive-mcp-tokens.json between runs.
 */

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import {
  PublicClientApplication,
  DeviceCodeRequest,
  AuthenticationResult,
} from "@azure/msal-node";
import { readFileSync, writeFileSync, existsSync } from "fs";
import { homedir } from "os";
import { join } from "path";

// ── Config ────────────────────────────────────────────────────────────────────

const CLIENT_ID = process.env.ONEDRIVE_CLIENT_ID;
const TOKEN_CACHE_PATH = join(homedir(), ".onedrive-mcp-tokens.json");
const GRAPH_BASE = "https://graph.microsoft.com/v1.0";
const SCOPES = ["Files.Read", "offline_access"];

if (!CLIENT_ID) {
  console.error(
    "[onedrive-mcp] ERROR: ONEDRIVE_CLIENT_ID environment variable is required."
  );
  process.exit(1);
}

// ── Token management ──────────────────────────────────────────────────────────

let cachedToken: AuthenticationResult | null = null;

function loadCachedToken(): AuthenticationResult | null {
  if (!existsSync(TOKEN_CACHE_PATH)) return null;
  try {
    return JSON.parse(readFileSync(TOKEN_CACHE_PATH, "utf8"));
  } catch {
    return null;
  }
}

function saveCachedToken(token: AuthenticationResult): void {
  writeFileSync(TOKEN_CACHE_PATH, JSON.stringify(token, null, 2), "utf8");
}

function isExpired(token: AuthenticationResult): boolean {
  if (!token.expiresOn) return true;
  return new Date(token.expiresOn).getTime() < Date.now() + 60_000;
}

const msalApp = new PublicClientApplication({
  auth: {
    clientId: CLIENT_ID!,
    authority: "https://login.microsoftonline.com/common",
  },
});

async function getAccessToken(): Promise<string> {
  // Return cached in-memory token if still valid
  if (cachedToken && !isExpired(cachedToken)) {
    return cachedToken.accessToken;
  }

  // Try silent refresh using disk cache
  const diskToken = loadCachedToken();
  if (diskToken && !isExpired(diskToken)) {
    cachedToken = diskToken;
    return diskToken.accessToken;
  }

  // Try silent acquire via MSAL account cache
  const accounts = await msalApp.getTokenCache().getAllAccounts();
  if (accounts.length > 0) {
    try {
      const result = await msalApp.acquireTokenSilent({
        account: accounts[0],
        scopes: SCOPES,
      });
      if (result) {
        cachedToken = result;
        saveCachedToken(result);
        return result.accessToken;
      }
    } catch {
      // Fall through to device code
    }
  }

  // Device code flow — prints URL to stderr (visible in Bob's MCP logs)
  const deviceCodeRequest: DeviceCodeRequest = {
    scopes: SCOPES,
    deviceCodeCallback: (response) => {
      console.error("\n" + "=".repeat(60));
      console.error("[onedrive-mcp] Authentication required.");
      console.error(`Visit: ${response.verificationUri}`);
      console.error(`Code:  ${response.userCode}`);
      console.error("=".repeat(60) + "\n");
    },
  };

  const result = await msalApp.acquireTokenByDeviceCode(deviceCodeRequest);
  if (!result) throw new Error("Authentication failed — no token returned.");
  cachedToken = result;
  saveCachedToken(result);
  return result.accessToken;
}

// ── Graph API helpers ─────────────────────────────────────────────────────────

async function graphGet(path: string): Promise<unknown> {
  const token = await getAccessToken();
  const res = await fetch(`${GRAPH_BASE}${path}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Graph API ${res.status}: ${body.slice(0, 300)}`);
  }
  return res.json();
}

async function graphGetBytes(path: string): Promise<ArrayBuffer> {
  const token = await getAccessToken();
  const res = await fetch(`${GRAPH_BASE}${path}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Graph API ${res.status}: ${body.slice(0, 300)}`);
  }
  return res.arrayBuffer();
}

// Encode a OneDrive path for use in Graph API URLs
function encodePath(p: string): string {
  // Strip leading slash, encode each segment
  const clean = p.replace(/^\//, "");
  if (!clean) return "/me/drive/root";
  return `/me/drive/root:/${encodeURIComponent(clean).replace(/%2F/g, "/")}`;
}

// ── Tools ─────────────────────────────────────────────────────────────────────

const server = new McpServer({ name: "onedrive-mcp", version: "1.0.0" });

// onedrive_list — list contents of a folder
server.tool(
  "onedrive_list",
  "List files and folders at a given OneDrive path. Leave path empty to list the root.",
  {
    path: z
      .string()
      .optional()
      .describe(
        'OneDrive folder path, e.g. "Documents" or "Disney Account". Leave empty for root.'
      ),
  },
  async ({ path: folderPath }) => {
    try {
      const base = folderPath
        ? `${encodePath(folderPath)}:/children`
        : "/me/drive/root/children";
      const data = (await graphGet(
        `${base}?$select=name,size,lastModifiedDateTime,file,folder&$top=100`
      )) as { value: Array<Record<string, unknown>> };

      const items = (data.value || []).map((item) => {
        const isFolder = !!item.folder;
        const size = item.size as number | undefined;
        const modified = item.lastModifiedDateTime as string | undefined;
        return `${isFolder ? "📁" : "📄"} ${item.name}${
          !isFolder && size ? `  (${Math.round(size / 1024)} KB)` : ""
        }${modified ? `  — ${new Date(modified).toLocaleDateString()}` : ""}`;
      });

      const header = `OneDrive: /${folderPath || ""}\n${"─".repeat(50)}\n`;
      return {
        content: [
          { type: "text" as const, text: header + items.join("\n") },
        ],
      };
    } catch (err) {
      return {
        content: [
          {
            type: "text" as const,
            text: `Error listing path: ${(err as Error).message}`,
          },
        ],
        isError: true,
      };
    }
  }
);

// onedrive_read — read a file's text content
server.tool(
  "onedrive_read",
  "Read the text content of a OneDrive file. Supports .txt, .md, .json, .csv, .html, .js, .ts, .py, .docx (plain text extraction), and .xlsx (plain text extraction).",
  {
    path: z
      .string()
      .describe('Full OneDrive path to the file, e.g. "Documents/notes.md"'),
  },
  async ({ path: filePath }) => {
    try {
      const ext = filePath.split(".").pop()?.toLowerCase() ?? "";
      const itemPath = encodePath(filePath);

      // For Office files, use the Graph /content endpoint with format conversion
      if (ext === "docx" || ext === "doc") {
        const bytes = await graphGetBytes(
          `${itemPath}:/content?format=txt`
        );
        const text = new TextDecoder().decode(bytes);
        return { content: [{ type: "text" as const, text }] };
      }

      if (ext === "xlsx" || ext === "xls") {
        // Download raw bytes and return a note — full Excel parsing requires
        // additional libraries. Return CSV-like text via Graph format conversion.
        const bytes = await graphGetBytes(
          `${itemPath}:/content?format=csv`
        );
        const text = new TextDecoder().decode(bytes);
        return { content: [{ type: "text" as const, text }] };
      }

      // Plain text files — download directly
      const bytes = await graphGetBytes(`${itemPath}:/content`);
      const text = new TextDecoder().decode(bytes);
      return { content: [{ type: "text" as const, text }] };
    } catch (err) {
      return {
        content: [
          {
            type: "text" as const,
            text: `Error reading file: ${(err as Error).message}`,
          },
        ],
        isError: true,
      };
    }
  }
);

// onedrive_search — search for files by name
server.tool(
  "onedrive_search",
  "Search for files across OneDrive by name or content keyword.",
  {
    query: z.string().describe("Search term, e.g. a filename or keyword"),
    max_results: z
      .number()
      .optional()
      .describe("Maximum number of results to return (default 20)"),
  },
  async ({ query, max_results = 20 }) => {
    try {
      const data = (await graphGet(
        `/me/drive/root/search(q='${encodeURIComponent(query)}')?$select=name,size,lastModifiedDateTime,parentReference&$top=${max_results}`
      )) as { value: Array<Record<string, unknown>> };

      if (!data.value?.length) {
        return {
          content: [
            { type: "text" as const, text: `No files found matching "${query}"` },
          ],
        };
      }

      const results = (data.value || []).map((item) => {
        const parent = (item.parentReference as Record<string, string> | undefined)?.path ?? "";
        const cleanPath = parent.replace("/drive/root:", "") + "/" + item.name;
        const modified = item.lastModifiedDateTime as string | undefined;
        const size = item.size as number | undefined;
        return `📄 ${cleanPath}${size ? `  (${Math.round(size / 1024)} KB)` : ""}${
          modified ? `  — ${new Date(modified).toLocaleDateString()}` : ""
        }`;
      });

      return {
        content: [
          {
            type: "text" as const,
            text: `Search results for "${query}":\n${"─".repeat(50)}\n${results.join("\n")}`,
          },
        ],
      };
    } catch (err) {
      return {
        content: [
          {
            type: "text" as const,
            text: `Error searching: ${(err as Error).message}`,
          },
        ],
        isError: true,
      };
    }
  }
);

// ── Start ─────────────────────────────────────────────────────────────────────

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("[onedrive-mcp] Server running on stdio");
}

main().catch((err) => {
  console.error("[onedrive-mcp] Fatal:", err.message);
  process.exit(1);
});
