/**
 * MCP server wiring — registers every tool + prompt and delegates to the
 * appropriate transport.
 */

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { PayPayClient } from "./client.js";
import type { Config } from "./config.js";
import { PayPayError } from "./errors.js";
import { logger } from "./logger.js";
import { prompts } from "./prompts/index.js";
import { resources } from "./resources/index.js";
import { tools } from "./tools/index.js";

export function buildServer(config: Config): McpServer {
  const client = new PayPayClient(config);

  const server = new McpServer(
    {
      name: "paypay-mcp",
      version: "0.1.0",
    },
    {
      capabilities: {
        tools: {},
        prompts: {},
        resources: {},
      },
    },
  );

  for (const tool of tools) {
    server.registerTool(
      tool.name,
      {
        title: tool.title,
        description: tool.description,
        inputSchema: tool.inputSchema.shape,
      },
      async (args: unknown) => {
        try {
          const parsed = tool.inputSchema.parse(args);
          const result = await tool.handler(parsed, client);

          if (result.type === "text") {
            return {
              content: [{ type: "text" as const, text: result.text }],
            };
          }

          return {
            content: [
              { type: "text" as const, text: result.text },
              {
                type: "image" as const,
                data: result.imagePng.toString("base64"),
                mimeType: result.mimeType,
              },
            ],
          };
        } catch (err) {
          if (err instanceof PayPayError) {
            logger.warn("PayPay error", { code: err.code, httpStatus: err.httpStatus });
            return {
              isError: true,
              content: [{ type: "text" as const, text: err.toToolError() }],
            };
          }
          logger.error("Tool handler failed", {
            tool: tool.name,
            error: err instanceof Error ? err.message : String(err),
          });
          return {
            isError: true,
            content: [
              {
                type: "text" as const,
                text: `Unexpected error in ${tool.name}: ${err instanceof Error ? err.message : String(err)}`,
              },
            ],
          };
        }
      },
    );
  }

  for (const prompt of prompts) {
    server.registerPrompt(
      prompt.name,
      {
        title: prompt.title,
        description: prompt.description,
      },
      async () => ({
        messages: [
          {
            role: "user" as const,
            content: { type: "text" as const, text: prompt.text },
          },
        ],
      }),
    );
  }

  for (const resource of resources) {
    server.registerResource(
      resource.name,
      resource.uri,
      {
        title: resource.title,
        description: resource.description,
        mimeType: resource.mimeType,
      },
      async (uri: URL) => ({
        contents: [
          {
            uri: uri.href,
            mimeType: resource.mimeType,
            text: resource.read(config),
          },
        ],
      }),
    );
  }

  return server;
}
