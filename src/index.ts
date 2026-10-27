#!/usr/bin/env node
/**
 * onedrive-mcp — MCP server for reading local OneDrive files into Bob
 *
 * OneDrive for Business syncs files to a local folder on this machine.
 * This server reads those local files directly — no Azure app, no OAuth.
 *
 * Root path: C:\Users\MikeArbrouet\OneDrive - IBM\
 * Override with ONEDRIVE_ROOT environment variable.
 *
 * Tools:
 *   onedrive_list   — list files/folders at a path
 *   onedrive_read   — read text content of a file
 *   onedrive_search — search for files by name across the OneDrive root
 */

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import {
  readdirSync,
  statSync,
  readFileSync,
  existsSync,
} from "fs";
import { join, resolve, extname, relative } from "path";

// ── Config ────────────────────────────────────────────────────────────────────

const ONEDRIVE_ROOT =
  process.env.ONEDRIVE_ROOT ??
  (process.platform === "win32"
    ? `C:\\Users\\${process.env.USERNAME ?? "user"}\\OneDrive - IBM`
    : `/Users/${process.env.USER ?? "user"}/OneDrive - IBM`);

if (!existsSync(ONEDRIVE_ROOT)) {
  console.error(
    `[onedrive-mcp] ERROR: OneDrive root not found at "${ONEDRIVE_ROOT}". ` +
    `Set ONEDRIVE_ROOT environment variable to override.`
  );
  process.exit(1);
}

// Resolve a user-supplied relative path safely under ONEDRIVE_ROOT
function safePath(userPath?: string): string {
  if (!userPath || userPath.trim() === "" || userPath === "/") {
    return ONEDRIVE_ROOT;
  }
  const full = resolve(ONEDRIVE_ROOT, userPath.replace(/^[\\/]+/, ""));
  // Prevent path traversal outside the root
  if (!full.startsWith(ONEDRIVE_ROOT)) {
    throw new Error(`Path "${userPath}" is outside OneDrive root.`);
  }
  return full;
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

// ── Server ────────────────────────────────────────────────────────────────────

const server = new McpServer({ name: "onedrive-mcp", version: "2.0.0" });

// ── onedrive_list ─────────────────────────────────────────────────────────────

server.tool(
  "onedrive_list",
  "List files and folders inside your local OneDrive (OneDrive - IBM). Leave path empty to list the root.",
  {
    path: z
      .string()
      .optional()
      .describe(
        'Subfolder to list, relative to OneDrive root. E.g. "Disney" or "Disney/Disney SAB". Leave empty for root.'
      ),
  },
  async ({ path: userPath }) => {
    try {
      const dir = safePath(userPath);
      if (!existsSync(dir)) {
        return {
          content: [{ type: "text" as const, text: `Path not found: ${userPath}` }],
          isError: true,
        };
      }
      const stat = statSync(dir);
      if (!stat.isDirectory()) {
        return {
          content: [{ type: "text" as const, text: `"${userPath}" is a file, not a folder. Use onedrive_read to read it.` }],
          isError: true,
        };
      }

      const entries = readdirSync(dir, { withFileTypes: true });
      const lines = entries
        .sort((a, b) => {
          // Folders first, then files, both alphabetical
          if (a.isDirectory() !== b.isDirectory()) return a.isDirectory() ? -1 : 1;
          return a.name.localeCompare(b.name);
        })
        .map((entry) => {
          if (entry.isDirectory()) {
            return `📁 ${entry.name}/`;
          }
          const full = join(dir, entry.name);
          const s = statSync(full);
          const modified = s.mtime.toLocaleDateString();
          return `📄 ${entry.name}  (${formatSize(s.size)})  — ${modified}`;
        });

      const relPath = relative(ONEDRIVE_ROOT, dir) || "(root)";
      const header = `OneDrive: ${relPath}\n${"─".repeat(50)}\n`;
      return {
        content: [{ type: "text" as const, text: header + (lines.length ? lines.join("\n") : "(empty folder)") }],
      };
    } catch (err) {
      return {
        content: [{ type: "text" as const, text: `Error: ${(err as Error).message}` }],
        isError: true,
      };
    }
  }
);

// ── onedrive_read ─────────────────────────────────────────────────────────────

const TEXT_EXTS = new Set([
  ".txt", ".md", ".markdown", ".json", ".jsonc", ".csv",
  ".html", ".htm", ".xml", ".yaml", ".yml",
  ".js", ".mjs", ".cjs", ".ts", ".tsx", ".jsx",
  ".py", ".sh", ".bat", ".ps1", ".sql",
  ".log", ".env", ".ini", ".toml", ".cfg",
]);

server.tool(
  "onedrive_read",
  "Read the text content of a file in your local OneDrive. Supports plain-text files (.txt, .md, .json, .csv, .py, .js, .html, etc.). For .docx/.xlsx use the office_read tool instead after noting the full path.",
  {
    path: z
      .string()
      .describe(
        'Path to the file relative to OneDrive root. E.g. "Disney/meeting-notes.md" or "Documents/report.txt"'
      ),
  },
  async ({ path: userPath }) => {
    try {
      const full = safePath(userPath);
      if (!existsSync(full)) {
        return {
          content: [{ type: "text" as const, text: `File not found: ${userPath}\nFull path checked: ${full}` }],
          isError: true,
        };
      }
      const stat = statSync(full);
      if (stat.isDirectory()) {
        return {
          content: [{ type: "text" as const, text: `"${userPath}" is a folder. Use onedrive_list to browse it.` }],
          isError: true,
        };
      }

      const ext = extname(full).toLowerCase();
      if (!TEXT_EXTS.has(ext)) {
        return {
          content: [{
            type: "text" as const,
            text:
              `"${userPath}" is a binary file (${ext}).\n` +
              `Full path: ${full}\n\n` +
              `To read it, use the office_read tool with:\n  path: ${full}`,
          }],
        };
      }

      // Size guard — cap at 500 KB to avoid flooding context
      if (stat.size > 500 * 1024) {
        return {
          content: [{
            type: "text" as const,
            text:
              `File is too large to read directly (${formatSize(stat.size)}).\n` +
              `Full path: ${full}\n` +
              `Use office_read or a more specific path.`,
          }],
          isError: true,
        };
      }

      const text = readFileSync(full, "utf8");
      return { content: [{ type: "text" as const, text }] };
    } catch (err) {
      return {
        content: [{ type: "text" as const, text: `Error reading file: ${(err as Error).message}` }],
        isError: true,
      };
    }
  }
);

// ── onedrive_search ───────────────────────────────────────────────────────────

function* walkDir(dir: string, maxDepth: number, depth = 0): Generator<string> {
  if (depth > maxDepth) return;
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) {
      yield* walkDir(full, maxDepth, depth + 1);
    } else {
      yield full;
    }
  }
}

server.tool(
  "onedrive_search",
  "Search for files by name across your local OneDrive. Returns matching file paths.",
  {
    query: z.string().describe("Filename keyword to search for (case-insensitive)"),
    folder: z
      .string()
      .optional()
      .describe('Limit search to a subfolder, e.g. "Disney". Leave empty to search all of OneDrive.'),
    max_results: z
      .number()
      .optional()
      .describe("Maximum results to return (default 25)"),
  },
  async ({ query, folder, max_results = 25 }) => {
    try {
      const searchRoot = safePath(folder);
      if (!existsSync(searchRoot)) {
        return {
          content: [{ type: "text" as const, text: `Folder not found: ${folder}` }],
          isError: true,
        };
      }

      const lower = query.toLowerCase();
      const matches: string[] = [];

      for (const fullPath of walkDir(searchRoot, 6)) {
        const name = fullPath.split(/[\\/]/).pop() ?? "";
        if (name.toLowerCase().includes(lower)) {
          matches.push(fullPath);
          if (matches.length >= max_results) break;
        }
      }

      if (!matches.length) {
        return {
          content: [{ type: "text" as const, text: `No files found matching "${query}"${folder ? ` in ${folder}` : ""}.` }],
        };
      }

      const lines = matches.map((p) => {
        const rel = relative(ONEDRIVE_ROOT, p);
        const s = statSync(p);
        return `📄 ${rel}  (${formatSize(s.size)})  — ${s.mtime.toLocaleDateString()}`;
      });

      return {
        content: [{
          type: "text" as const,
          text: `Found ${matches.length} file(s) matching "${query}":\n${"─".repeat(50)}\n${lines.join("\n")}`,
        }],
      };
    } catch (err) {
      return {
        content: [{ type: "text" as const, text: `Error searching: ${(err as Error).message}` }],
        isError: true,
      };
    }
  }
);

// ── Start ─────────────────────────────────────────────────────────────────────

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error(`[onedrive-mcp] Server running. Root: ${ONEDRIVE_ROOT}`);
}

main().catch((err) => {
  console.error("[onedrive-mcp] Fatal:", err.message);
  process.exit(1);
});
