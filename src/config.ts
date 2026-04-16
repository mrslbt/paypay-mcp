/**
 * Configuration loaded from environment variables.
 * Fails fast with a clear message if required values are missing.
 */

export type PayPayEnv = "sandbox" | "production";

export interface Config {
  apiKey: string;
  apiSecret: string;
  merchantId: string;
  env: PayPayEnv;
  baseUrl: string;
  transport: "stdio" | "http";
  httpPort: number;
  /** Bind address for HTTP transport. Defaults to 127.0.0.1. */
  httpHost: string;
  /** Bearer token required on inbound HTTP requests when transport=http. */
  httpAuthToken?: string;
  /** Comma-separated allowlist of CORS origins. Defaults to empty (no cross-origin). */
  httpAllowedOrigins: string[];
}

const SANDBOX_BASE_URL = "https://apigw.sandbox.paypay.ne.jp";
const PRODUCTION_BASE_URL = "https://apigw.paypay.ne.jp";

function required(name: string): string {
  const value = process.env[name];
  if (!value || value.trim() === "") {
    throw new Error(
      `Missing required environment variable: ${name}. ` +
        `Set it in your MCP client config or .env file. ` +
        `See https://github.com/mrslbt/paypay-mcp#configuration`,
    );
  }
  return value.trim();
}

export function loadConfig(): Config {
  const env = (process.env.PAYPAY_ENV ?? "sandbox") as PayPayEnv;
  if (env !== "sandbox" && env !== "production") {
    throw new Error(
      `PAYPAY_ENV must be "sandbox" or "production", got: ${env}`,
    );
  }

  const transport = (process.env.MCP_TRANSPORT ?? "stdio") as "stdio" | "http";
  if (transport !== "stdio" && transport !== "http") {
    throw new Error(
      `MCP_TRANSPORT must be "stdio" or "http", got: ${transport}`,
    );
  }

  const httpAllowedOrigins = (process.env.MCP_HTTP_ALLOWED_ORIGINS ?? "")
    .split(",")
    .map((o) => o.trim())
    .filter(Boolean);

  return {
    apiKey: required("PAYPAY_API_KEY"),
    apiSecret: required("PAYPAY_API_SECRET"),
    merchantId: required("PAYPAY_MERCHANT_ID"),
    env,
    baseUrl: env === "production" ? PRODUCTION_BASE_URL : SANDBOX_BASE_URL,
    transport,
    httpPort: Number(process.env.MCP_HTTP_PORT ?? 3000),
    httpHost: process.env.MCP_HTTP_HOST?.trim() || "127.0.0.1",
    httpAuthToken: process.env.MCP_AUTH_TOKEN?.trim() || undefined,
    httpAllowedOrigins,
  };
}
