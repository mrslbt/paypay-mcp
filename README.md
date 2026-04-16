# paypay-mcp

A Model Context Protocol server for [PayPay](https://paypay.ne.jp/), Japan's largest QR wallet (70M+ users, ¥15.4T processed in FY2024).

Any MCP-compatible client (Claude Desktop, Claude Code, Cursor, Windsurf, Zed, ChatGPT Apps SDK, etc.) can use this to create PayPay QR codes, check payment status, issue refunds, and manage transactions through natural language, in English or Japanese.

## Why

PayPal, Stripe, Razorpay, PayU, and Naver Pay all have MCP servers. PayPay didn't. I wrote this one.

A few things it does that most payment MCPs skip:

- Tool descriptions are written in both English and Japanese (with appropriate keigo), so an agent can reason about a request in the user's language without going through translation first.
- `create_qr_code` returns a rendered PNG as an MCP image resource, not just a URL. Clients that render images inline show the QR to the user immediately.
- `wait_for_payment` wraps the polling loop PayPay's API requires, so the agent doesn't have to build one.

## Tools (v0.1)

| Tool | What it does |
|---|---|
| `create_qr_code` | Create a dynamic PayPay QR code. Returns the payment URL, deeplink, and an inline PNG. |
| `get_payment_details` | Check the current status of a payment. |
| `wait_for_payment` | Poll until a payment reaches a terminal state. Uses PayPay's recommended 2-3s interval. |
| `delete_qr_code` | Invalidate a QR code before it's paid. |
| `refund_payment` | Full or partial refund. |
| `cancel_payment` | Safe cancellation when the payment state is unclear (timeout or error). |

Also includes MCP prompts for the common flows: `accept_single_payment`, `refund_last_payment`, `debug_stuck_payment`.

## Install

```bash
npm install -g paypay-mcp
```

Or run on demand with `npx paypay-mcp`. Most MCP clients invoke it that way and don't need a global install.

## Configuration

Get credentials from the [PayPay Developer Dashboard](https://developer.paypay.ne.jp/).

| Variable | Required | Description |
|---|---|---|
| `PAYPAY_API_KEY` | yes | OPA API Key ID |
| `PAYPAY_API_SECRET` | yes | OPA API Key Secret |
| `PAYPAY_MERCHANT_ID` | yes | Your merchant ID |
| `PAYPAY_ENV` | no | `sandbox` (default) or `production` |
| `MCP_TRANSPORT` | no | `stdio` (default) or `http` |
| `MCP_HTTP_PORT` | no | Port when `MCP_TRANSPORT=http`. Default `3000`. |
| `MCP_HTTP_HOST` | no | Bind address. Default `127.0.0.1`. Set to `0.0.0.0` to expose publicly, in which case `MCP_AUTH_TOKEN` is required. |
| `MCP_AUTH_TOKEN` | no | Bearer token required on inbound HTTP requests when set. Mandatory for non-loopback binds. |
| `MCP_HTTP_ALLOWED_ORIGINS` | no | Comma-separated CORS origin allowlist. Default: no cross-origin. |

### Claude Desktop

Edit `~/Library/Application Support/Claude/claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "paypay": {
      "command": "npx",
      "args": ["-y", "paypay-mcp"],
      "env": {
        "PAYPAY_API_KEY": "a_...",
        "PAYPAY_API_SECRET": "...",
        "PAYPAY_MERCHANT_ID": "...",
        "PAYPAY_ENV": "sandbox"
      }
    }
  }
}
```

### Claude Code

```bash
claude mcp add paypay -e PAYPAY_API_KEY=... -e PAYPAY_API_SECRET=... -e PAYPAY_MERCHANT_ID=... -- npx -y paypay-mcp
```

### Cursor

Add to `~/.cursor/mcp.json` with the same shape as Claude Desktop.

### Remote hosting (Glama, Smithery, ChatGPT Apps SDK, your own infra)

Run in HTTP mode. Public binds require `MCP_AUTH_TOKEN`; the server refuses to start otherwise.

```bash
MCP_TRANSPORT=http \
  MCP_HTTP_HOST=0.0.0.0 \
  MCP_AUTH_TOKEN="$(openssl rand -hex 32)" \
  MCP_HTTP_ALLOWED_ORIGINS="https://claude.ai,https://your-app.example.com" \
  PAYPAY_ENV=sandbox \
  PAYPAY_API_KEY=... PAYPAY_API_SECRET=... PAYPAY_MERCHANT_ID=... \
  npx paypay-mcp
```

MCP endpoint: `POST http(s)://<host>:3000/mcp` (Streamable HTTP transport). Clients send `Authorization: Bearer <MCP_AUTH_TOKEN>`. CORS is closed by default; add origins via `MCP_HTTP_ALLOWED_ORIGINS`.

For local testing you can omit the auth token. The server binds to `127.0.0.1` and only accepts loopback connections.

## Example session

> **You**: Create a ¥500 PayPay QR code for "Matcha latte".
>
> **Agent**: *(calls `create_qr_code`)*
> PayPay QR code created. merchantPaymentId: a1b2c3... Expires in 5 minutes. [image rendered inline]
>
> **You**: Let me know when it's paid.
>
> **Agent**: *(calls `wait_for_payment`)*
> Payment reached terminal status: COMPLETED. ¥500 received at 2026-04-17T02:14:33Z.

## Sandbox vs production

Sandbox is for development. No real money moves. Free credentials at [developer.paypay.ne.jp](https://developer.paypay.ne.jp/).

Production requires PayPay merchant onboarding (business verification and a contract). Once you have live credentials this MCP runs against production, but test on sandbox first. It won't switch to production unless you explicitly set `PAYPAY_ENV=production`.

## Constraints to know

- Cancellation window: a payment can be canceled until 00:14:59 JST the day after the payment attempt. After that, use a refund.
- Amounts are integer JPY, no decimals.
- TLS 1.2+ required (Node 20+ handles this).
- A single order can receive multiple partial refunds as long as each uses a unique `merchantRefundId` and the total stays within the merchant-configured cap.

## Development

```bash
git clone https://github.com/mrslbt/paypay-mcp.git
cd paypay-mcp
npm install
cp .env.example .env   # fill in sandbox credentials
npm run dev            # stdio server with auto-reload
npm test               # unit tests
npm run smoke          # sandbox round-trip (creates + deletes a QR)
npm run build          # compile to dist/
```

## Roadmap

v0.2:
- PreAuth + Capture (hold / settle flows)
- ContinuousPayments (subscriptions)
- DirectDebit (account-linked pulls)
- AccountLink QR flow
- Webhook signature verification tool
- Reconciliation (batch refund lookup, daily settlement)

v0.3:
- Native Payment (App Invoke + user JWT auth)
- Visa-partnership endpoints as they launch
- OpenTelemetry tracing

## License

[MIT](LICENSE)

## Credits

Built by [mrslbt](https://github.com/mrslbt). Not affiliated with PayPay Corporation; this is a community integration against the public Open Payment API.

If you're from PayPay and want to talk about an official partnership or adoption, open an issue.
