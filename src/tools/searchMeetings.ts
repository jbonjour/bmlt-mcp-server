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

Returns a list of meetings matching the given filters. All filters are optional.
Default server is the global NA aggregator (all meetings worldwide).

Args:
  - root_server_url (string, optional): BMLT root server URL. Defaults to "${DEFAULT_ROOT_SERVER}"
  - service_body_ids (number[], optional): Filter by service body IDs. Omit to search all bodies.
  - weekdays (string[], optional): Filter by day(s) of week. Accepts day names like "Monday", "tuesday", or numbers 1–7 (1=Sunday)
  - formats (string[], optional): Filter by format codes, e.g. ["O"] for Open, ["VM"] for Virtual, ["C"] for Closed
  - venue_types (number[], optional): Filter by venue: 1=In-person, 2=Virtual, 3=Hybrid
  - search_string (string, optional): Full-text search across all meeting fields (name, location, comments, etc.)
  - meeting_name (string, optional): Search meetings by name only (partial match). Use search_string for broader search.
  - location (string, optional): Filter by city/municipality name, e.g. "Portland" or "Vancouver"
  - lat (number, optional): Latitude for geo search. Requires lng. Results sorted by distance.
  - lng (number, optional): Longitude for geo search. Requires lat.
  - radius_miles (number, optional): Search radius in miles when using lat/lng. Default: 10
  - start_time_min (string, optional): Only meetings starting at or after this time, format "HH:MM" (24h)
  - start_time_max (string, optional): Only meetings starting at or before this time, format "HH:MM" (24h)
  - max_results (number, optional): Limit results per page. Use with page for pagination.
  - page (number, optional): Page number when using max_results (1-indexed). Default: 1
  - response_format (string, optional): "markdown" (default) or "json"

Returns: Formatted list of meetings with name, day, time, location, formats, distance, and links.

Examples:
  - "NA meetings on Friday in Portland" → weekdays: ["Friday"], location: "Portland"
  - "Open in-person meetings near me" → venue_types: [1], formats: ["O"], lat: ..., lng: ...
  - "Virtual meetings tonight after 7pm" → venue_types: [2], start_time_min: "19:00"
  - "Hybrid or virtual step study meetings" → venue_types: [2,3], search_string: "step study"
  - "Morning meetings" → start_time_max: "12:00"
  - "Meetings in Vancouver" → location: "Vancouver"`,
      inputSchema: z.object({
        root_server_url: z.string().url().optional()
          .describe(`BMLT root server URL (default: "${DEFAULT_ROOT_SERVER}")`),
        service_body_ids: z.array(z.number().int().positive()).optional()
          .describe("Service body IDs to search (omit to search all bodies on the server)"),
        weekdays: z.array(z.union([
          z.string().describe("Day name, e.g. 'Monday', 'tuesday', 'Wed'"),
          z.number().int().min(1).max(7).describe("Day number 1–7 (1=Sunday)")
        ])).optional()
          .describe("Filter by day(s) of week"),
        formats: z.array(z.string()).optional()
          .describe("Format codes to filter by, e.g. ['O'] for Open, ['VM'] for Virtual"),
        venue_types: z.array(z.number().int().min(1).max(3)).optional()
          .describe("Filter by venue type: 1=In-person, 2=Virtual, 3=Hybrid"),
        search_string: z.string().optional()
          .describe("Full-text search across all meeting fields (name, location, comments, etc.)"),
        meeting_name: z.string().optional()
          .describe("Search by meeting name only (partial match). Use search_string for broader search."),
        location: z.string().optional()
          .describe("Filter by city/municipality name, e.g. 'Portland' or 'Vancouver'"),
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
        max_results: z.number().int().positive().optional()
          .describe("Maximum number of results to return per page"),
        page: z.number().int().positive().default(1)
          .describe("Page number when using max_results (1-indexed, default: 1)"),
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
      const serviceBodyIds = params.service_body_ids ??
        (DEFAULT_SERVICE_BODY_ID !== null ? [DEFAULT_SERVICE_BODY_ID] : undefined);

      // Normalize weekday inputs (strings or numbers) → BMLT numbers (1–7)
      const weekdays = params.weekdays?.map((d) => {
        if (typeof d === "number") return d;
        const key = d.toLowerCase();
        const num = WEEKDAY_BY_NAME[key];
        if (!num) throw new Error(`Unknown weekday: "${d}". Use names like "Monday" or numbers 1–7 (1=Sunday).`);
        return num;
      });

      const { meetings, total } = await searchMeetings({
        rootServer: root,
        serviceBodyIds,
        weekdays,
        formats: params.formats,
        venueTypes: params.venue_types,
        searchString: params.search_string,
        meetingName: params.meeting_name,
        location: params.location,
        lat: params.lat,
        lng: params.lng,
        radiusMiles: params.radius_miles,
        startTimeMin: params.start_time_min,
        startTimeMax: params.start_time_max,
        pageSize: params.max_results,
        pageNum: params.page
      });

      if (!meetings.length) {
        return {
          content: [{ type: "text", text: "No meetings found matching the given filters." }]
        };
      }

      const paginationNote = params.max_results && meetings.length === params.max_results
        ? `\n\n_Showing page ${params.page} · ${meetings.length} results. Use \`page: ${params.page + 1}\` to see more._`
        : "";

      if (params.response_format === "json") {
        const output = { count: meetings.length, total, page: params.page, meetings };
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
        content: [{ type: "text", text: truncate(header + body + paginationNote, CHARACTER_LIMIT) }]
      };
    }
  );
}
