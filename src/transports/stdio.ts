import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { buildServer } from "../server.js";
import type { Config } from "../config.js";
import { logger } from "../logger.js";

export async function runStdio(config: Config): Promise<void> {
  const server = buildServer(config);
  const transport = new StdioServerTransport();
  await server.connect(transport);
  logger.info("paypay-mcp ready on stdio", { env: config.env, merchantId: config.merchantId });
}
