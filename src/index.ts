#!/usr/bin/env node
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { createServer } from "http";
import { DEFAULT_ROOT_SERVER, DEFAULT_SERVICE_BODY_ID } from "./constants.js";
import { registerSearchMeetingsTool } from "./tools/searchMeetings.js";
import { registerMetaTools } from "./tools/metaTools.js";
import { registerGetMeetingDetailsTool } from "./tools/getMeetingDetails.js";

// ─── Server setup ─────────────────────────────────────────────────────────────

const server = new McpServer({
  name: "bmlt-mcp-server",
  version: "1.0.0"
});

// Register all tools
registerSearchMeetingsTool(server);
registerMetaTools(server);
registerGetMeetingDetailsTool(server);

// ─── Transport ────────────────────────────────────────────────────────────────

const transport = (process.env.TRANSPORT ?? "stdio").toLowerCase();

if (transport === "http") {
  const port = parseInt(process.env.PORT ?? "3000", 10);

  const httpServer = createServer(async (req, res) => {
    if (req.method !== "POST" || req.url !== "/mcp") {
      res.writeHead(404);
      res.end("Not found. POST to /mcp");
      return;
    }

    const chunks: Buffer[] = [];
    req.on("data", (chunk: Buffer) => chunks.push(chunk));
    req.on("end", async () => {
      let body: unknown;
      try {
        body = JSON.parse(Buffer.concat(chunks).toString());
      } catch {
        res.writeHead(400);
        res.end("Invalid JSON");
        return;
      }

      const mcpTransport = new StreamableHTTPServerTransport({
        sessionIdGenerator: undefined,
        enableJsonResponse: true
      });

      res.on("close", () => mcpTransport.close());

      await server.connect(mcpTransport);

      // Adapt req/res for the SDK's handleRequest
      const adaptedReq = Object.assign(req, { body });
      await mcpTransport.handleRequest(adaptedReq as Parameters<typeof mcpTransport.handleRequest>[0], res, body);
    });
  });

  httpServer.listen(port, () => {
    process.stderr.write(
      `BMLT MCP server running at http://localhost:${port}/mcp\n` +
      `  Default root server: ${DEFAULT_ROOT_SERVER}\n` +
      `  Default service body: ${DEFAULT_SERVICE_BODY_ID} (Portland NA)\n`
    );
  });
} else {
  // Default: stdio (for Claude Desktop, Claude Code, etc.)
  const stdioTransport = new StdioServerTransport();
  server.connect(stdioTransport).then(() => {
    process.stderr.write(
      `BMLT MCP server started (stdio)\n` +
      `  Default root server: ${DEFAULT_ROOT_SERVER}\n` +
      `  Default service body: ${DEFAULT_SERVICE_BODY_ID} (Portland NA)\n`
    );
  }).catch((err: unknown) => {
    process.stderr.write(`Fatal error: ${String(err)}\n`);
    process.exit(1);
  });
}
