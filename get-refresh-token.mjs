#!/usr/bin/env node
/**
 * get-refresh-token.mjs
 *
 * One-time setup script — run this ONCE to authenticate with Microsoft
 * and save a token cache that onedrive-mcp will reuse automatically.
 *
 * Usage:
 *   node get-refresh-token.mjs
 *
 * It will print a URL and a code. Visit the URL, enter the code, sign in
 * with your IBM Microsoft account. Tokens are saved to ~/.onedrive-mcp-tokens.json
 */

import { PublicClientApplication } from "@azure/msal-node";
import { writeFileSync } from "fs";
import { homedir } from "os";
import { join } from "path";

const CLIENT_ID = process.env.ONEDRIVE_CLIENT_ID;
const TOKEN_CACHE_PATH = join(homedir(), ".onedrive-mcp-tokens.json");

if (!CLIENT_ID) {
  console.error("ERROR: ONEDRIVE_CLIENT_ID environment variable is not set.");
  console.error(
    "Set it first:  $env:ONEDRIVE_CLIENT_ID='your-app-client-id'  (PowerShell)"
  );
  process.exit(1);
}

const app = new PublicClientApplication({
  auth: {
    clientId: CLIENT_ID,
    authority: "https://login.microsoftonline.com/common",
  },
});

console.log("\n[onedrive-mcp] Starting device code authentication...\n");

const result = await app.acquireTokenByDeviceCode({
  scopes: ["Files.Read", "offline_access"],
  deviceCodeCallback: (response) => {
    console.log("=".repeat(60));
    console.log("1. Open this URL in your browser:");
    console.log(`   ${response.verificationUri}`);
    console.log("");
    console.log("2. Enter this code when prompted:");
    console.log(`   ${response.userCode}`);
    console.log("=".repeat(60));
    console.log("\nWaiting for you to complete sign-in...");
  },
});

if (!result) {
  console.error("Authentication failed — no token returned.");
  process.exit(1);
}

writeFileSync(TOKEN_CACHE_PATH, JSON.stringify(result, null, 2), "utf8");
console.log(`\n✅ Authentication successful! Token saved to ${TOKEN_CACHE_PATH}`);
console.log("You can now use onedrive-mcp in Bob without re-authenticating.");
console.log(
  `Token expires: ${result.expiresOn ? new Date(result.expiresOn).toLocaleString() : "unknown"}`
);
