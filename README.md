# onedrive-mcp

A custom MCP server that lets **IBM Bob** read files directly from your Microsoft OneDrive / IBM OneDrive (OneDrive for Business).

## What it does

Exposes three tools to Bob:

| Tool | Description |
|---|---|
| `onedrive_list` | List files and folders at any OneDrive path |
| `onedrive_read` | Read the text content of a file (.txt, .md, .json, .csv, .docx, .xlsx, etc.) |
| `onedrive_search` | Search for files by name or keyword across all of OneDrive |

## Prerequisites

- **Node.js 18+**
- A registered **Azure App Registration** with `Files.Read` delegated permission  
  (see [Azure Setup](#azure-app-registration-one-time) below)
- Your **Client ID** from the app registration

---

## Quick Start

### 1. Clone and install

```powershell
git clone https://github.com/MikeArbrouet/onedrive-mcp.git
cd onedrive-mcp
npm install
npm run build
```

### 2. Azure App Registration (one-time)

1. Go to [https://portal.azure.com](https://portal.azure.com) → **Azure Active Directory** → **App registrations** → **New registration**
2. Name: `onedrive-mcp`  
   Supported account types: **Accounts in any organizational directory**  
   Redirect URI: leave blank
3. Click **Register**
4. Copy the **Application (client) ID** — this is your `ONEDRIVE_CLIENT_ID`
5. Go to **API permissions** → **Add a permission** → **Microsoft Graph** → **Delegated** → add:
   - `Files.Read`
   - `offline_access`
6. Click **Grant admin consent** (or ask your IT admin)

### 3. Set the environment variable

```powershell
# PowerShell — add to your profile for persistence
$env:ONEDRIVE_CLIENT_ID = "your-client-id-here"
```

Or add it to your system environment variables permanently via:  
**Settings → System → About → Advanced system settings → Environment Variables**

### 4. Authenticate (one-time)

```powershell
node get-refresh-token.mjs
```

This runs a device code flow — it prints a URL and a short code. Open the URL in your browser, enter the code, sign in with your IBM Microsoft account. Your token is saved to `~/.onedrive-mcp-tokens.json` and reused automatically on future runs.

### 5. Register in Bob

Add this to `C:\Users\<you>\.bob\settings\mcp.json` under `mcpServers`:

```json
"onedrive": {
  "command": "node",
  "args": ["C:\\path\\to\\onedrive-mcp\\build\\index.js"],
  "env": {
    "ONEDRIVE_CLIENT_ID": "${env:ONEDRIVE_CLIENT_ID}"
  }
}
```

Bob hot-reloads on save. Check the MCP panel — you should see **onedrive** connected with 3 tools.

---

## Usage examples

Once connected, ask Bob:

- *"List my OneDrive root"*
- *"List the files in my Disney Account folder on OneDrive"*
- *"Read the file Documents/meeting-notes.md from OneDrive"*
- *"Search OneDrive for Technology Plan"*
- *"Read the Technology Plan docx from OneDrive"*

---

## Token refresh

Tokens are cached at `~/.onedrive-mcp-tokens.json`. MSAL handles silent refresh automatically. If your token expires and silent refresh fails (e.g. after a long period of inactivity), re-run:

```powershell
node get-refresh-token.mjs
```

---

## Project structure

```
onedrive-mcp/
├── src/
│   └── index.ts          # MCP server — all three tools
├── build/                # Compiled output (after npm run build)
│   └── index.js
├── get-refresh-token.mjs # One-time OAuth device code flow
├── package.json
├── tsconfig.json
└── README.md
```

---

## Tools reference

### `onedrive_list`

Lists files and folders at a given path.

| Parameter | Type | Required | Description |
|---|---|---|---|
| `path` | string | No | OneDrive folder path (e.g. `"Documents"` or `"Disney Account"`). Leave empty for root. |

### `onedrive_read`

Reads the text content of a file.

| Parameter | Type | Required | Description |
|---|---|---|---|
| `path` | string | Yes | Full path to the file (e.g. `"Documents/notes.md"`) |

Supported formats: `.txt`, `.md`, `.json`, `.csv`, `.html`, `.js`, `.ts`, `.py`, `.docx`, `.xlsx`, and any plain-text file.

### `onedrive_search`

Searches OneDrive by filename or content keyword.

| Parameter | Type | Required | Description |
|---|---|---|---|
| `query` | string | Yes | Search term |
| `max_results` | number | No | Maximum results to return (default 20) |

---

## Troubleshooting

| Problem | Fix |
|---|---|
| `ONEDRIVE_CLIENT_ID environment variable is required` | Set the env var and restart Bob |
| `Graph API 401` | Re-run `node get-refresh-token.mjs` |
| `Graph API 403` | Check your Azure app has `Files.Read` permission and admin consent was granted |
| Server not appearing in Bob MCP panel | Confirm the build path in `mcp.json` is correct and run `npm run build` |

---

## License

MIT
