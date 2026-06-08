# AGENTS.md — paypay-mcp

Instructions for AI coding agents (Codex, Cursor, Copilot, Claude Code, etc.) contributing to this repository.

## What this project is

`paypay-mcp` is a Model Context Protocol server for the **PayPay Open Payment API** (PayPay OPA) — Japan's largest QR-wallet payment platform. It lets MCP-capable clients (Claude Desktop, Claude Code, Cursor, Cline, etc.) create QR codes, check payment status, and (opt-in) issue refunds or cancel payments.

Distribution: published to npm as `paypay-mcp`. Local stdio transport by default; streamable HTTP transport opt-in via `MCP_TRANSPORT=http`.

## Quick commands

```bash
npm install        # install dependencies
npm run typecheck  # tsc --noEmit, must pass before commit
npm run build      # tsc → dist/
npm test           # vitest run — must pass before commit
npm run dev        # tsx watch src/index.ts (stdio)
npm run start      # node dist/index.js (stdio)
npm run start:http # node dist/index.js with MCP_TRANSPORT=http
npm run smoke      # tests/smoke.mjs — connects to a real PayPay sandbox
npm run test:e2e   # tests/mcp_e2e.mjs — full MCP protocol round-trip
```

Pre-commit: `npm run typecheck && npm test`. Both must pass. Tests currently complete in <1s; collection is the slow part (~2.5 min) — this is a known TS-loading cost, not a test failure.

## Architecture (the only mental model you need)

```
src/
├── index.ts           # entry point — dispatches to transport
├── config.ts          # loadConfig() — env-driven, fails fast on missing required vars
├── auth.ts            # PayPay OPA HMAC signing (verified against paypayopa/paypayopa-sdk-node)
├── client.ts          # PayPayClient — wraps fetch + sign + error handling
├── errors.ts          # PayPayError — typed error surfacing
├── logger.ts          # structured stderr logger
├── server.ts          # buildServer(config) — wires tools/prompts/resources into McpServer
├── transports/
│   ├── stdio.ts       # StdioServerTransport (default)
│   └── http.ts        # StreamableHTTPServerTransport with bearer-token auth + CORS
├── tools/
│   ├── types.ts       # ToolDefinition<TInput>, ToolResult, helpers
│   ├── index.ts       # tool registry — controls what gets registered
│   └── *.ts           # one file per tool
├── prompts/index.ts   # prompt registry
└── resources/index.ts # resource registry
```

The MCP SDK is `@modelcontextprotocol/sdk` 1.29+. Code uses the high-level `McpServer` API with `registerTool`/`registerPrompt`/`registerResource`. Do NOT introduce the lower-level `Server` + `setRequestHandler` pattern — it bypasses the higher-level type safety and loses introspection.

## How to add a new tool

The canonical pattern, derived from `src/tools/create_qr_code.ts`:

```ts
// src/tools/your_new_tool.ts
import { z } from "zod";
import { textResult, type ToolDefinition } from "./types.js";

const input = z.object({
  some_field: z
    .string()
    .describe("English description. 日本語訳もここに。"),
  // Every field MUST have a .describe() with both English AND Japanese.
  // Bilingual descriptions are a deliberate product decision — first-class JP support.
});

export const yourNewTool: ToolDefinition<typeof input> = {
  name: "your_new_tool",                          // snake_case
  title: "Human-Readable Title",
  description: [
    "English description. Tell the LLM when to use this.",
    "Returns: short summary of the response shape.",
    "",
    "日本語の説明。LLMがいつ使うべきかを伝える。",
  ].join("\n"),
  inputSchema: input,
  // REQUIRED: declare the tool's safety profile (see "Safety conventions" §3).
  // Read-only tool → { readOnlyHint: true, openWorldHint: true }
  // Money-moving / irreversible → { readOnlyHint: false, destructiveHint: true, openWorldHint: true }
  annotations: {
    readOnlyHint: false,
    destructiveHint: false,
    idempotentHint: false,
    openWorldHint: true,
  },
  async handler(args, client) {
    const res = await client.request<{ /* response shape */ }>({
      method: "POST",
      path: "/v2/your_endpoint",
      body: { /* PayPay-shaped body */ },
    });
    return textResult(`Result summary in plain text.`);
  },
};
```

Then register it in `src/tools/index.ts`:

```ts
import { yourNewTool } from "./your_new_tool.js";

// If the tool is read-only / safe to expose by default:
const base: ToolDefinition<any>[] = [
  /* ...existing tools, */
  yourNewTool,
];

// If the tool moves money or has irreversible side effects, GATE IT:
if (config.enableYourNewToolFlag) base.push(yourNewTool);

// Also add to the unconditional `tools` array used by tests/docs:
export const tools: ToolDefinition<any>[] = [
  /* ...existing, */
  yourNewTool,
];
```

Then add a test in `tests/tools.test.ts` and run `npm test`.

## Safety conventions (read carefully)

This project handles real money. Two non-negotiable patterns:

**1. Money-moving tools are env-flag-gated AND registration-conditional.**

`refund_payment` and `cancel_payment` are NOT registered with the MCP server unless the user explicitly sets `PAYPAY_ENABLE_REFUNDS=true` or `PAYPAY_ENABLE_CANCELS=true`. From the model's perspective, these tools **do not exist** unless the operator opted in. This is more prompt-injection-resistant than "tools exist but refuse at call time."

If you add another irreversible/destructive tool, follow the same pattern:
- Add an env flag in `src/config.ts` (`enableXxx`)
- In `src/tools/index.ts`, conditionally push the tool ONLY when the flag is true
- Document the flag in the README's `Safety` section

**2. Sandbox is the default, production is opt-in.**

`PAYPAY_ENV` defaults to `"sandbox"`. Production base URL is only used when `PAYPAY_ENV=production`. Do NOT remove this default. Do NOT introduce code paths that silently route to production.

**3. Every tool declares its safety profile via `annotations` (required field).**

`ToolDefinition.annotations` is **mandatory** — the compiler will reject a tool that omits it. These are the standard MCP [tool annotations](https://modelcontextprotocol.io/specification) (`readOnlyHint`, `destructiveHint`, `idempotentHint`, `openWorldHint`), surfaced to clients so they can warn the user before a money-moving or destructive call. They are *hints*, not enforcement — the real guard is the env-flag gating in §1. Be honest:
- Pure GET / no state change → `readOnlyHint: true`.
- Moves money or is irreversible (refund, cancel) or removes a resource (delete) → `destructiveHint: true`, `readOnlyHint: false`.
- Creates something but moves no funds yet (create_qr_code) → `readOnlyHint: false`, `destructiveHint: false`.

`tests/tools.test.ts` asserts this contract (read-only tools aren't destructive; refund/cancel/delete are). If you add a tool, the test loop covers the "declares annotations" check automatically; add it to the right destructive/read-only list if applicable.

## Bilingual descriptions are not optional

Every tool description, every Zod field `.describe()`, and every prompt MUST include both English and Japanese text. This is a deliberate product decision — paypay-mcp targets Japanese merchants and English-speaking developers equally. Anglo-only descriptions degrade the Japanese AI agent experience and will be rejected.

See `src/tools/create_qr_code.ts` for the canonical format: English first, blank line, then Japanese.

## HTTP transport requirements

If touching `src/transports/http.ts`:

- Bearer token (`MCP_AUTH_TOKEN`) is required for any non-localhost binding. Do not introduce code that allows unauthenticated network exposure.
- CORS origins come from `MCP_HTTP_ALLOWED_ORIGINS` (comma-separated). Default is empty (no cross-origin). Do not relax to `*`.
- Default bind is `127.0.0.1`. Changing the default to a public interface requires a deliberate config opt-in.

## Tests

`vitest` for unit + integration; `.mjs` files in `tests/` for E2E and smoke that hit the real PayPay sandbox.

- `tests/auth.test.ts` — HMAC signing, verified against PayPay's official SDK behavior
- `tests/client.test.ts` — request lifecycle + error mapping
- `tests/config.test.ts` — config loading and validation
- `tests/errors.test.ts` — PayPayError surface
- `tests/http.test.ts` — HTTP transport auth + CORS
- `tests/prompts.test.ts` — prompt registry
- `tests/tools.test.ts` — tool registry, gating behavior, and the safety-annotation contract
- `tests/smoke.mjs` — single tool call against real sandbox (requires real env)
- `tests/mcp_e2e.mjs` — full MCP protocol round-trip (requires real env)

Add a test for any new tool. Tests must pass before commit.

## What NOT to do

- **Do not** introduce the low-level `Server` + `setRequestHandler` SDK pattern. Stay on `McpServer` + `registerXxx`.
- **Do not** add money-moving tools without env-flag gating + registration-conditional inclusion.
- **Do not** ship a tool with English-only descriptions.
- **Do not** change the default `PAYPAY_ENV` from `"sandbox"`.
- **Do not** add third-party dependencies for cryptography. Use `node:crypto` only — HMAC signing is verified against PayPay's official SDK and must stay deterministic.
- **Do not** log API secrets, merchant IDs, or full payment payloads. Logger is structured and stderr-only — keep it that way.
- **Do not** commit `dist/`, `.env`, or `node_modules`. They are git-ignored.

## Release process

1. Bump version in `package.json`
2. Bump version in `src/server.ts` (the `McpServer` constructor — this is what gets reported during the initialize handshake)
3. Bump version in `server.json` (both the top-level `version` and the `packages[0].version`)
4. `npm run typecheck && npm test` — both must pass
5. `npm run build`
6. Commit with a message describing the change
7. `npm publish`
8. `git push origin main`

All four version locations must match. The mismatch between `package.json` (0.1.2) and `src/server.ts` (0.1.1) that existed before 0.1.3 was a real bug — it caused the MCP to report a stale version during the initialize handshake.

## Useful PayPay OPA references

- Developer Dashboard: https://developer.paypay.ne.jp/
- API reference: https://www.paypay.ne.jp/opa/doc/v1.0/
- Sandbox base URL: `https://apigw.sandbox.paypay.ne.jp`
- Production base URL: `https://apigw.paypay.ne.jp`
- Official Node SDK (reference for auth correctness): `paypayopa/paypayopa-sdk-node`

## Maintainer

Built by Marsel Bait (https://marselbait.me). Part of a portfolio of MCP servers focused on the Japan/SEA region and AI-native tooling.
