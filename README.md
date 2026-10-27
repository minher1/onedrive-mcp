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

- **Node.js 18+** — download at [nodejs.org](https://nodejs.org) if not installed (`node --version` to check)
- OneDrive for Business synced to your local machine via the **OneDrive app**
  - **Windows:** typically `C:\Users\<you>\OneDrive - IBM`
  - **Mac:** typically `/Users/<you>/OneDrive - IBM`
  - To confirm: open Finder (Mac) or File Explorer (Windows) and look for a folder named **OneDrive - IBM**

---

## Quick Start

### Windows

#### 1. Clone and install

Open PowerShell and run:

```powershell
cd "$HOME\Documents"
git clone https://github.ibm.com/marbrouet/onedrive-mcp.git
cd onedrive-mcp
npm install
npm run build
```

#### 2. Register in Bob

Open `C:\Users\<you>\.bob\settings\mcp.json` in any text editor and add the `onedrive` entry inside the existing `mcpServers` block:

```json
{
  "mcpServers": {
    "onedrive": {
      "command": "node",
      "args": ["C:\\Users\\<you>\\Documents\\onedrive-mcp\\build\\index.js"]
    }
  }
}
```

> If you already have other servers in `mcp.json`, just add the `"onedrive": { ... }` block alongside them — don't replace the whole file.

Save the file. Bob hot-reloads on save — check the MCP panel and you should see **onedrive** with a green dot and 3 tools.

---

### Mac

#### 1. Clone and install

Open Terminal and run:

```bash
cd ~/Documents
git clone https://github.ibm.com/marbrouet/onedrive-mcp.git
cd onedrive-mcp
npm install
npm run build
```

#### 2. Register in Bob

Open `~/.bob/settings/mcp.json` in any text editor (e.g. `open -e ~/.bob/settings/mcp.json`) and add the `onedrive` entry inside the existing `mcpServers` block:

```json
{
  "mcpServers": {
    "onedrive": {
      "command": "node",
      "args": ["/Users/<you>/Documents/onedrive-mcp/build/index.js"]
    }
  }
}
```

> Replace `<you>` with your Mac username (`whoami` in Terminal to check).
> If you already have other servers in `mcp.json`, just add the `"onedrive": { ... }` block alongside them — don't replace the whole file.

Save the file. Bob hot-reloads on save — check the MCP panel and you should see **onedrive** with a green dot and 3 tools.

---

### Overriding the OneDrive root path (both platforms)

The server auto-detects your platform and defaults to:
- **Windows:** `C:\Users\<you>\OneDrive - IBM`
- **Mac:** `/Users/<you>/OneDrive - IBM`

If your OneDrive syncs to a different folder, add an `env` block:

**Windows:**
```json
"onedrive": {
  "command": "node",
  "args": ["C:\\Users\\<you>\\Documents\\onedrive-mcp\\build\\index.js"],
  "env": {
    "ONEDRIVE_ROOT": "C:\\Users\\<you>\\OneDrive - IBM"
  }
}
```

**Mac:**
```json
"onedrive": {
  "command": "node",
  "args": ["/Users/<you>/Documents/onedrive-mcp/build/index.js"],
  "env": {
    "ONEDRIVE_ROOT": "/Users/<you>/OneDrive - IBM"
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
