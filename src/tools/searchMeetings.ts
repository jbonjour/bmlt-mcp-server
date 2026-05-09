import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { DEFAULT_ROOT_SERVER, DEFAULT_SERVICE_BODY_ID, CHARACTER_LIMIT, WEEKDAY_BY_NAME } from "../constants.js";
import { searchMeetings, getFormats } from "../services/bmlt.js";
import { formatMeeting, buildFormatMap, truncate } from "../services/formatting.js";

export function registerSearchMeetingsTool(server: McpServer): void {
  server.registerTool(
    "bmlt_search_meetings",
    {
      title: "Search NA Meetings",
      description: `Search for Narcotics Anonymous meetings in the BMLT database.

Returns a list of meetings matching the given filters. All filters are optional — omitting them returns all meetings for the default service body.

Args:
  - root_server_url (string, optional): BMLT root server URL. Defaults to "${DEFAULT_ROOT_SERVER}"
  - service_body_ids (number[], optional): Filter by service body IDs. Defaults to [${DEFAULT_SERVICE_BODY_ID}] (Portland NA)
  - weekdays (string[], optional): Filter by day(s) of week. Accepts day names like "Monday", "tuesday", or numbers 1–7 (1=Sunday)
  - formats (string[], optional): Filter by format codes, e.g. ["O"] for Open, ["VM"] for Virtual, ["C"] for Closed
  - meeting_name (string, optional): Search meetings by name (partial match)
  - lat (number, optional): Latitude for geo search. Requires lng.
  - lng (number, optional): Longitude for geo search. Requires lat.
  - radius_miles (number, optional): Search radius in miles when using lat/lng. Default: 10
  - start_time_min (string, optional): Only meetings starting at or after this time, format "HH:MM" (24h)
  - start_time_max (string, optional): Only meetings starting at or before this time, format "HH:MM" (24h)
  - response_format (string, optional): "markdown" (default) or "json"

Returns: Formatted list of meetings with name, day, time, location, formats, and links.

Examples:
  - "Show all Portland NA meetings on Friday" → weekdays: ["Friday"]
  - "Find open meetings near downtown Portland" → formats: ["O"], lat: 45.5231, lng: -122.6765
  - "Virtual meetings this week" → formats: ["VM"]
  - "Morning meetings" → start_time_max: "12:00"`,
      inputSchema: z.object({
        root_server_url: z.string().url().optional()
          .describe(`BMLT root server URL (default: "${DEFAULT_ROOT_SERVER}")`),
        service_body_ids: z.array(z.number().int().positive()).optional()
          .describe(`Service body IDs to search (default: [${DEFAULT_SERVICE_BODY_ID}] = Portland NA)`),
        weekdays: z.array(z.union([
          z.string().describe("Day name, e.g. 'Monday', 'tuesday', 'Wed'"),
          z.number().int().min(1).max(7).describe("Day number 1–7 (1=Sunday)")
        ])).optional()
          .describe("Filter by day(s) of week"),
        formats: z.array(z.string()).optional()
          .describe("Format codes to filter by, e.g. ['O'] for Open, ['VM'] for Virtual"),
        meeting_name: z.string().optional()
          .describe("Search meetings by name (partial match)"),
        lat: z.number().min(-90).max(90).optional()
          .describe("Latitude for geographic search"),
        lng: z.number().min(-180).max(180).optional()
          .describe("Longitude for geographic search"),
        radius_miles: z.number().positive().default(10)
          .describe("Search radius in miles when using lat/lng (default: 10)"),
        start_time_min: z.string().regex(/^\d{2}:\d{2}$/).optional()
          .describe("Earliest start time filter, format HH:MM (24h), e.g. '08:00'"),
        start_time_max: z.string().regex(/^\d{2}:\d{2}$/).optional()
          .describe("Latest start time filter, format HH:MM (24h), e.g. '12:00'"),
        response_format: z.enum(["markdown", "json"]).default("markdown")
          .describe("Output format: 'markdown' for human-readable or 'json' for structured data")
      }).strict(),
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: true
      }
    },
    async (params) => {
      const root = params.root_server_url ?? DEFAULT_ROOT_SERVER;
      const serviceBodyIds = params.service_body_ids ?? [DEFAULT_SERVICE_BODY_ID];

      // Normalize weekday inputs (strings or numbers) → BMLT numbers (1–7)
      const weekdays = params.weekdays?.map((d) => {
        if (typeof d === "number") return d;
        const key = d.toLowerCase();
        const num = WEEKDAY_BY_NAME[key];
        if (!num) throw new Error(`Unknown weekday: "${d}". Use names like "Monday" or numbers 1–7 (1=Sunday).`);
        return num;
      });

      const meetings = await searchMeetings({
        rootServer: root,
        serviceBodyIds,
        weekdays,
        formats: params.formats,
        meetingName: params.meeting_name,
        lat: params.lat,
        lng: params.lng,
        radiusMiles: params.radius_miles,
        startTimeMin: params.start_time_min,
        startTimeMax: params.start_time_max
      });

      if (!meetings.length) {
        return {
          content: [{ type: "text", text: "No meetings found matching the given filters." }]
        };
      }

      if (params.response_format === "json") {
        const output = { count: meetings.length, meetings };
        return {
          content: [{ type: "text", text: truncate(JSON.stringify(output, null, 2), CHARACTER_LIMIT) }],
          structuredContent: output
        };
      }

      // Markdown: fetch formats for labels
      let formatMap: Record<string, string> = {};
      try {
        const formats = await getFormats(root);
        formatMap = buildFormatMap(formats);
      } catch {
        // Non-fatal — format codes will show raw
      }

      const header = `Found **${meetings.length}** meeting${meetings.length === 1 ? "" : "s"}:\n\n---\n\n`;
      const body = meetings.map((m) => formatMeeting(m, formatMap)).join("\n\n---\n\n");
      return {
        content: [{ type: "text", text: truncate(header + body, CHARACTER_LIMIT) }]
      };
    }
  );
}
