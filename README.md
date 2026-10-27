# onedrive-mcp

A custom MCP server that lets **IBM Bob** read files directly from your local OneDrive folder (OneDrive for Business / OneDrive - IBM).

OneDrive for Business syncs your cloud files to a local folder on your machine. This server reads those local files directly — **no Azure app registration, no OAuth, no API keys required**.

## What it does

Exposes three tools to Bob:

| Tool | Description |
|---|---|
| `onedrive_list` | List files and folders at any OneDrive path |
| `onedrive_read` | Read the text content of a file (.txt, .md, .json, .csv, .py, .js, .html, etc.) |
| `onedrive_search` | Search for files by name keyword across your OneDrive |

For binary Office files (`.docx`, `.xlsx`, `.pptx`), `onedrive_read` returns the full local path so Bob can immediately hand it off to the `office_read` tool.

## Prerequisites

- **Node.js 18+**
- OneDrive for Business synced to your local machine (default path: `C:\Users\<you>\OneDrive - IBM`)

---

## Quick Start

### 1. Clone and install

```powershell
git clone https://github.com/minher1/onedrive-mcp.git
cd onedrive-mcp
npm install
npm run build
```

### 2. Register in Bob

Add this to `C:\Users\<you>\.bob\settings\mcp.json` under `mcpServers`:

```json
"onedrive": {
  "command": "node",
  "args": ["C:\\path\\to\\onedrive-mcp\\build\\index.js"]
}
```

Bob hot-reloads on save. Check the MCP panel — you should see **onedrive** connected with 3 tools.

### 3. (Optional) Override the OneDrive root path

If your OneDrive syncs to a different folder, set the `ONEDRIVE_ROOT` environment variable:

```json
"onedrive": {
  "command": "node",
  "args": ["C:\\path\\to\\onedrive-mcp\\build\\index.js"],
  "env": {
    "ONEDRIVE_ROOT": "C:\\Users\\you\\OneDrive - IBM"
  }
}
```

---

## Usage examples

Once connected, ask Bob:

- *"List my OneDrive root"*
- *"List the files in my Disney folder on OneDrive"*
- *"Read the file Disney/meeting-notes.md from OneDrive"*
- *"Search OneDrive for Technology Plan"*
- *"Search my Publix Super Markets folder on OneDrive for IBM"*

---

## Project structure

```
onedrive-mcp/
├── src/
│   └── index.ts     # MCP server — all three tools
├── build/           # Compiled output (after npm run build)
│   └── index.js
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
| `path` | string | No | Subfolder relative to OneDrive root (e.g. `"Disney"` or `"Disney/Disney SAB"`). Leave empty for root. |

### `onedrive_read`

Reads the text content of a file.

| Parameter | Type | Required | Description |
|---|---|---|---|
| `path` | string | Yes | File path relative to OneDrive root (e.g. `"Disney/notes.md"`) |

Supported text formats: `.txt`, `.md`, `.json`, `.csv`, `.html`, `.js`, `.ts`, `.py`, `.sh`, `.bat`, `.ps1`, `.sql`, `.yaml`, `.xml`, and more.

For `.docx`, `.xlsx`, `.pptx` — returns the full local path for use with Bob's `office_read` tool.

### `onedrive_search`

Searches OneDrive by filename keyword.

| Parameter | Type | Required | Description |
|---|---|---|---|
| `query` | string | Yes | Filename keyword (case-insensitive) |
| `folder` | string | No | Limit search to a subfolder (e.g. `"Disney"`) |
| `max_results` | number | No | Maximum results to return (default 25) |

---

## Troubleshooting

| Problem | Fix |
|---|---|
| Server not appearing in Bob MCP panel | Confirm the `args` path in `mcp.json` points to `build/index.js` and run `npm run build` |
| `OneDrive root not found` | Set `ONEDRIVE_ROOT` in the `env` block to your actual OneDrive sync folder |
| File not found errors | Make sure OneDrive is synced (check the OneDrive tray icon — it should show a green checkmark) |

---

## License

MIT
