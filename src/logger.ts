/**
 * Structured logger that writes to stderr (never stdout — stdout is the MCP
 * transport channel when running over stdio). All outbound payloads are
 * redacted for obvious secret-shaped values.
 */

type Level = "debug" | "info" | "warn" | "error";

const SECRET_KEYS = new Set([
  "apiSecret",
  "api_secret",
  "PAYPAY_API_SECRET",
  "authorization",
  "Authorization",
  "secret",
  "password",
  "token",
]);

function redact(value: unknown): unknown {
  if (value == null) return value;
  if (typeof value !== "object") return value;
  if (Array.isArray(value)) return value.map(redact);
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
    out[k] = SECRET_KEYS.has(k) ? "[REDACTED]" : redact(v);
  }
  return out;
}

function emit(level: Level, msg: string, meta?: unknown) {
  const line = {
    ts: new Date().toISOString(),
    level,
    msg,
    ...(meta !== undefined ? { meta: redact(meta) } : {}),
  };
  process.stderr.write(JSON.stringify(line) + "\n");
}

export const logger = {
  debug: (msg: string, meta?: unknown) => {
    if (process.env.PAYPAY_MCP_DEBUG) emit("debug", msg, meta);
  },
  info: (msg: string, meta?: unknown) => emit("info", msg, meta),
  warn: (msg: string, meta?: unknown) => emit("warn", msg, meta),
  error: (msg: string, meta?: unknown) => emit("error", msg, meta),
};
