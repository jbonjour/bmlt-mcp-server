import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { DEFAULT_ROOT_SERVER, CHARACTER_LIMIT } from "../constants.js";
import { getFormats, getServiceBodies, getServerInfo } from "../services/bmlt.js";
import { formatServiceBody, truncate } from "../services/formatting.js";

export function registerMetaTools(server: McpServer): void {

  // ── bmlt_get_formats ──────────────────────────────────────────────────────

  server.registerTool(
    "bmlt_get_formats",
    {
      title: "Get Meeting Formats",
      description: `Retrieve all meeting format codes and their descriptions from a BMLT root server.

Formats describe the type of meeting — e.g. "O" = Open, "C" = Closed, "VM" = Virtual Meeting,
"BT" = Book Study, "D" = Discussion, "SP" = Speaker, "WC" = Wheelchair Accessible.

Use this to:
- Discover what format codes are available before filtering a meeting search
- Explain what a format code means to a user
- List all available meeting types on the server

Args:
  - root_server_url (string, optional): BMLT root server URL. Defaults to "${DEFAULT_ROOT_SERVER}"
  - response_format (string, optional): "markdown" (default) or "json"

Returns: List of format codes, names, and descriptions.`,
      inputSchema: z.object({
        root_server_url: z.string().url().optional()
          .describe(`BMLT root server URL (default: "${DEFAULT_ROOT_SERVER}")`),
        response_format: z.enum(["markdown", "json"]).default("markdown")
          .describe("Output format: 'markdown' or 'json'")
      }).strict(),
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: false
      }
    },
    async (params) => {
      const root = params.root_server_url ?? DEFAULT_ROOT_SERVER;
      const formats = await getFormats(root);

      if (!formats.length) {
        return { content: [{ type: "text", text: "No formats found on this server." }] };
      }

      if (params.response_format === "json") {
        return {
          content: [{ type: "text", text: JSON.stringify(formats, null, 2) }],
          structuredContent: { formats }
        };
      }

      const lines = formats.map(f =>
        `**${f.key_string}** — ${f.name_string}${f.description_string ? `: ${f.description_string}` : ""}`
      );
      const text = `## Meeting Formats (${formats.length} total)\n\n` + lines.join("\n");
      return { content: [{ type: "text", text: truncate(text, CHARACTER_LIMIT) }] };
    }
  );

  // ── bmlt_get_service_bodies ───────────────────────────────────────────────

  server.registerTool(
    "bmlt_get_service_bodies",
    {
      title: "Get Service Bodies",
      description: `Retrieve all service bodies (NA regions, areas, districts) from a BMLT root server.

Service bodies are the organizational units that manage meeting data in BMLT. Knowing the ID of a
service body lets you filter meeting searches to a specific area.

Use this to:
- Discover service body IDs for use in bmlt_search_meetings
- See the hierarchy of areas served by a root server
- Find a specific area's helpline or website

Args:
  - root_server_url (string, optional): BMLT root server URL. Defaults to "${DEFAULT_ROOT_SERVER}"
  - response_format (string, optional): "markdown" (default) or "json"

Returns: List of service bodies with IDs, names, types, URLs, and helplines.

Example: Portland NA has service body ID ${26} on the WSZF root server.`,
      inputSchema: z.object({
        root_server_url: z.string().url().optional()
          .describe(`BMLT root server URL (default: "${DEFAULT_ROOT_SERVER}")`),
        response_format: z.enum(["markdown", "json"]).default("markdown")
          .describe("Output format: 'markdown' or 'json'")
      }).strict(),
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: false
      }
    },
    async (params) => {
      const root = params.root_server_url ?? DEFAULT_ROOT_SERVER;
      const bodies = await getServiceBodies(root);

      if (!bodies.length) {
        return { content: [{ type: "text", text: "No service bodies found on this server." }] };
      }

      if (params.response_format === "json") {
        return {
          content: [{ type: "text", text: JSON.stringify(bodies, null, 2) }],
          structuredContent: { service_bodies: bodies }
        };
      }

      const text = `## Service Bodies (${bodies.length} total)\n\n` +
        bodies.map(formatServiceBody).join("\n\n---\n\n");
      return { content: [{ type: "text", text: truncate(text, CHARACTER_LIMIT) }] };
    }
  );

  // ── bmlt_get_server_info ──────────────────────────────────────────────────

  server.registerTool(
    "bmlt_get_server_info",
    {
      title: "Get Server Info",
      description: `Retrieve metadata about a BMLT root server, including version and geographic center.

Use this to verify a server is reachable, check its version, or get its default center coordinates.

Args:
  - root_server_url (string, optional): BMLT root server URL. Defaults to "${DEFAULT_ROOT_SERVER}"

Returns: Server version, center lat/lng, default zoom level, and region bias.`,
      inputSchema: z.object({
        root_server_url: z.string().url().optional()
          .describe(`BMLT root server URL (default: "${DEFAULT_ROOT_SERVER}")`)
      }).strict(),
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: false
      }
    },
    async (params) => {
      const root = params.root_server_url ?? DEFAULT_ROOT_SERVER;
      const info = await getServerInfo(root);

      const text = [
        `## BMLT Server Info`,
        `**URL:** ${root}`,
        `**Version:** ${info.version}`,
        `**Center:** ${info.centerLatitude}, ${info.centerLongitude} (zoom ${info.centerZoom})`,
        info.regionBias ? `**Region Bias:** ${info.regionBias}` : null,
        info.defaultDuration ? `**Default Duration:** ${info.defaultDuration}` : null
      ].filter(Boolean).join("\n");

      return {
        content: [{ type: "text", text }],
        structuredContent: info
      };
    }
  );
}
