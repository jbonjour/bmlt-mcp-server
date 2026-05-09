# bmlt-mcp-server

An [MCP (Model Context Protocol)](https://modelcontextprotocol.io) server for the [Basic Meeting List Toolbox (BMLT)](https://bmlt.app) — the open-source meeting database used by Narcotics Anonymous service bodies worldwide.

Connect Claude (or any MCP-compatible AI client) to a BMLT root server and query NA meeting data using natural language.

---

## What it does

Exposes four tools:

| Tool | Description |
|------|-------------|
| `bmlt_search_meetings` | Search meetings by day, format, location, name, or geo coordinates |
| `bmlt_get_meeting_details` | Get full details for a specific meeting by ID |
| `bmlt_get_formats` | List all meeting format codes and descriptions (O, C, VM, BT, etc.) |
| `bmlt_get_service_bodies` | List all service bodies (areas/regions) on the root server |
| `bmlt_get_server_info` | Check root server version and geographic center |

### Example prompts once connected

- *"What NA meetings are happening in Portland tonight?"*
- *"Find open virtual meetings on Tuesday"*
- *"Show me all meetings within 5 miles of downtown Portland"*
- *"What does the format code 'BT' mean?"*
- *"List all service bodies on the WSZF server"*

---

## Defaults

Out of the box, the server points to:

- **Root server:** `https://bmlt.wszf.org/main_server` (WSZF network)
- **Default service body:** `26` (Portland Area NA)

All tools accept a `root_server_url` parameter to point at any BMLT root server, and `service_body_ids` to scope searches to other areas.

---

## Installation

```bash
git clone https://github.com/jbonjour/bmlt-mcp-server.git
cd bmlt-mcp-server
npm install
npm run build
```

---

## Usage

### With Claude Desktop (stdio — recommended)

Add to your Claude Desktop config (`~/Library/Application Support/Claude/claude_desktop_config.json` on macOS):

```json
{
  "mcpServers": {
    "bmlt": {
      "command": "node",
      "args": ["/absolute/path/to/bmlt-mcp-server/dist/index.js"]
    }
  }
}
```

Restart Claude Desktop. You'll see the BMLT tools available in your chat.

### With Claude Code

```bash
claude mcp add bmlt node /absolute/path/to/bmlt-mcp-server/dist/index.js
```

### HTTP mode (for remote/multi-client use)

```bash
TRANSPORT=http PORT=3000 node dist/index.js
# Server listens on http://localhost:3000/mcp
```

---

## Development

```bash
npm install
npm run build      # compile TypeScript → dist/
npm start          # run compiled server (stdio)

# Or run via HTTP for testing:
TRANSPORT=http PORT=3000 npm start
```

To test with the MCP Inspector:

```bash
npx @modelcontextprotocol/inspector node dist/index.js
```

---

## Environment variables

| Variable | Default | Description |
|----------|---------|-------------|
| `TRANSPORT` | `stdio` | Transport mode: `stdio` or `http` |
| `PORT` | `3000` | HTTP port (only used when `TRANSPORT=http`) |

---

## Changing the default root server or service body

Edit `src/constants.ts`:

```typescript
export const DEFAULT_ROOT_SERVER = "https://bmlt.wszf.org/main_server";
export const DEFAULT_SERVICE_BODY_ID = 26; // Portland NA
```

Then rebuild: `npm run build`

---

## BMLT root servers

Any NA service body running BMLT can be queried. Common root servers:

| Network | URL |
|---------|-----|
| WSZF (Pacific Northwest) | `https://bmlt.wszf.org/main_server` |
| NA World Services (aggregator) | `https://na.org/main_server` |

Find your region's root server at [bmlt.app](https://bmlt.app).

---

## Contributing

PRs welcome. This was built to support Portland Area NA's website modernization project and open-sourced for the broader NA tech community.

---

## License

MIT — free to use, share, and modify. All work done by and for the NA community.
