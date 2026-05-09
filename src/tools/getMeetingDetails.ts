import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { DEFAULT_ROOT_SERVER, DEFAULT_SERVICE_BODY_ID } from "../constants.js";
import { searchMeetings, getFormats } from "../services/bmlt.js";
import { formatMeeting, buildFormatMap } from "../services/formatting.js";

export function registerGetMeetingDetailsTool(server: McpServer): void {
  server.registerTool(
    "bmlt_get_meeting_details",
    {
      title: "Get Meeting Details",
      description: `Retrieve full details for a specific NA meeting by its BMLT meeting ID.

Use this after bmlt_search_meetings to get the complete record for a specific meeting.

Args:
  - meeting_id (number): The BMLT meeting ID (the "id_bigint" field from search results)
  - root_server_url (string, optional): BMLT root server URL. Defaults to "${DEFAULT_ROOT_SERVER}"
  - service_body_ids (number[], optional): Service body IDs to scope the search. Defaults to [${DEFAULT_SERVICE_BODY_ID}]
  - response_format (string, optional): "markdown" (default) or "json"

Returns: Full meeting record including name, day, time, location, formats, virtual links, and all metadata fields.`,
      inputSchema: z.object({
        meeting_id: z.number().int().positive()
          .describe("The BMLT meeting ID (id_bigint field from search results)"),
        root_server_url: z.string().url().optional()
          .describe(`BMLT root server URL (default: "${DEFAULT_ROOT_SERVER}")`),
        service_body_ids: z.array(z.number().int().positive()).optional()
          .describe(`Service body IDs (default: [${DEFAULT_SERVICE_BODY_ID}] = Portland NA)`),
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
      const serviceBodyIds = params.service_body_ids ?? [DEFAULT_SERVICE_BODY_ID];

      // Fetch all meetings and find the one matching the ID
      // (BMLT doesn't have a direct single-meeting endpoint in the public semantic interface)
      const meetings = await searchMeetings({ rootServer: root, serviceBodyIds });
      const meeting = meetings.find(m => String(m.id_bigint) === String(params.meeting_id));

      if (!meeting) {
        return {
          content: [{
            type: "text",
            text: `No meeting found with ID ${params.meeting_id} in the specified service bodies.\n\nTip: Use bmlt_search_meetings first to find the meeting and confirm the ID.`
          }]
        };
      }

      if (params.response_format === "json") {
        return {
          content: [{ type: "text", text: JSON.stringify(meeting, null, 2) }],
          structuredContent: meeting
        };
      }

      let formatMap: Record<string, string> = {};
      try {
        const formats = await getFormats(root);
        formatMap = buildFormatMap(formats);
      } catch {
        // Non-fatal
      }

      return {
        content: [{ type: "text", text: formatMeeting(meeting, formatMap) }],
        structuredContent: meeting
      };
    }
  );
}
