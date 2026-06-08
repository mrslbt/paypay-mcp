/**
 * MCP server wiring — registers every tool + prompt and delegates to the
 * appropriate transport.
 */

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { PayPayClient } from "./client.js";
import type { Config } from "./config.js";
import { PayPayError } from "./errors.js";
import { logger } from "./logger.js";
import { getPrompts } from "./prompts/index.js";
import { resources } from "./resources/index.js";
import { getTools } from "./tools/index.js";

const SERVER_INSTRUCTIONS = [
  "paypay-mcp — create and manage PayPay (Japan's QR-wallet) payments via the PayPay Open Payment API.",
  "",
  "Tool safety profile (also surfaced as MCP tool annotations):",
  "- get_payment_details, wait_for_payment — READ-ONLY. Safe to call freely.",
  "- create_qr_code — creates a payment QR. No money moves until the customer pays in the PayPay app.",
  "- delete_qr_code — destructive: invalidates a created QR code.",
  "- refund_payment, cancel_payment — MONEY-MOVING and irreversible. They are only registered when the operator sets PAYPAY_ENABLE_REFUNDS / PAYPAY_ENABLE_CANCELS; if you don't see them, they are intentionally disabled. ALWAYS confirm the exact id and amount with the user before calling.",
  "",
  "Environment: runs against the PayPay sandbox by default; production requires PAYPAY_ENV=production. Amounts are in JPY (integer yen, no decimals).",
  "",
  "Unofficial, community-built. Not affiliated with PayPay Corporation.",
].join("\n");

export function buildServer(config: Config): McpServer {
  const client = new PayPayClient(config);
  const tools = getTools(config);
  const prompts = getPrompts(config);

  const server = new McpServer(
    {
      name: "paypay-mcp",
      version: "0.2.0",
    },
    {
      capabilities: {
        tools: {},
        prompts: {},
        resources: {},
      },
      instructions: SERVER_INSTRUCTIONS,
    },
  );

  for (const tool of tools) {
    server.registerTool(
      tool.name,
      {
        title: tool.title,
        description: tool.description,
        inputSchema: tool.inputSchema.shape,
        annotations: tool.annotations,
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
