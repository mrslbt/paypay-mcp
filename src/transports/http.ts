/**
 * Streamable HTTP transport — for remote hosting (Glama, Smithery, ChatGPT
 * Apps SDK, Claude web) and any MCP client that speaks HTTP rather than stdio.
 *
 * Security model:
 *   - HTTP transport always requires MCP_AUTH_TOKEN. We refuse to start
 *     without it because relying on peer-address checks is not safe behind
 *     same-host reverse proxies or local tunnel agents.
 *   - Every inbound request must include
 *     `Authorization: Bearer <token>`.
 *   - CORS defaults to no cross-origin access. Use MCP_HTTP_ALLOWED_ORIGINS
 *     (comma-separated) to explicitly allow known origins.
 *
 * Stateless mode: one transport per request, no session state. Any instance
 * can serve any request, so the server runs behind a plain load balancer —
 * aligned with the MCP 2026-07-28 stateless core.
 *
 * Spec: https://modelcontextprotocol.io/specification/server/transports
 */

import { timingSafeEqual } from "node:crypto";
import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { buildServer } from "../server.js";
import type { Config } from "../config.js";
import { logger } from "../logger.js";

export async function runHttp(config: Config): Promise<void> {
  if (!config.httpAuthToken) {
    throw new Error(
      "Refusing to start: MCP_TRANSPORT=http requires MCP_AUTH_TOKEN. " +
        "Set MCP_AUTH_TOKEN to a strong random string before enabling HTTP transport.",
    );
  }

  const httpServer = createServer(async (req, res) => {
    const origin = req.headers.origin;
    if (origin && config.httpAllowedOrigins.includes(origin)) {
      res.setHeader("Access-Control-Allow-Origin", origin);
      res.setHeader("Vary", "Origin");
      res.setHeader("Access-Control-Allow-Credentials", "true");
    }
    res.setHeader("Access-Control-Allow-Methods", "GET, POST, DELETE, OPTIONS");
    res.setHeader(
      "Access-Control-Allow-Headers",
      "Content-Type, Mcp-Session-Id, Authorization",
    );
    if (req.method === "OPTIONS") {
      res.writeHead(204);
      res.end();
      return;
    }

    if (req.url !== "/mcp") {
      res.writeHead(404);
      res.end();
      return;
    }

    if (!checkAuth(req, config)) {
      res.writeHead(401, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: "unauthorized" }));
      return;
    }

    // Stateless: one transport + server instance per request, closed after.
    // Any instance can serve any request — no sticky sessions required.
    const transport = new StreamableHTTPServerTransport({
      sessionIdGenerator: undefined,
    });

    try {
      const server = buildServer(config);
      await server.connect(transport);
      const body = await readBody(req);
      await transport.handleRequest(req, res, body);
    } catch (err) {
      logger.error("HTTP handler failed", {
        error: err instanceof Error ? err.message : String(err),
      });
      if (!res.headersSent) {
        res.writeHead(500, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ error: "internal_server_error" }));
      }
    } finally {
      try {
        await transport.close();
      } catch {
        // best-effort cleanup
      }
    }
  });

  httpServer.listen(config.httpPort, config.httpHost, () => {
    logger.info("paypay-mcp listening on HTTP", {
      host: config.httpHost,
      port: config.httpPort,
      env: config.env,
      authRequired: Boolean(config.httpAuthToken),
      allowedOrigins: config.httpAllowedOrigins,
    });
  });
}

function checkAuth(req: IncomingMessage, config: Config): boolean {
  const header = req.headers.authorization;
  if (typeof header !== "string" || !header.startsWith("Bearer ")) return false;
  const presented = Buffer.from(header.slice("Bearer ".length));
  const expected = Buffer.from(config.httpAuthToken!);
  if (presented.length !== expected.length) return false;
  return timingSafeEqual(presented, expected);
}

async function readBody(req: IncomingMessage): Promise<unknown> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    req.on("data", (c) => chunks.push(c));
    req.on("end", () => {
      const raw = Buffer.concat(chunks).toString("utf8");
      if (!raw) return resolve(undefined);
      try {
        resolve(JSON.parse(raw));
      } catch (e) {
        reject(e);
      }
    });
    req.on("error", reject);
  });
}
