# paypay-mcp

[![MCP Badge](https://lobehub.com/badge/mcp/mrslbt-paypay-mcp)](https://lobehub.com/mcp/mrslbt-paypay-mcp)

Model Context Protocol server for the [PayPay Open Payment API](https://www.paypay.ne.jp/opa/doc/v1.0/).

Works with Claude Desktop, Claude Code, Cursor, Windsurf, Zed, ChatGPT Apps SDK, and any other MCP-compatible client. Tool descriptions are provided in English and Japanese.

## Tools

| Tool | Description |
|---|---|
| `create_qr_code` | Create a dynamic PayPay QR code. Returns the payment URL, deeplink, and a rendered PNG. |
| `get_payment_details` | Fetch the current status of a payment. |
| `wait_for_payment` | Poll until a payment reaches a terminal state. |
| `delete_qr_code` | Invalidate a QR code before payment. |
| `refund_payment` | Full or partial refund. **Disabled unless `PAYPAY_ENABLE_REFUNDS=true`.** |
| `cancel_payment` | Cancel a payment when its state is unclear (timeout or error). **Disabled unless `PAYPAY_ENABLE_CANCELS=true`.** |

## Prompts

`accept_single_payment`, `refund_last_payment`, `debug_stuck_payment`.

## Resources

| URI | Description |
|---|---|
| `paypay://docs/opa-reference` | Endpoint map, auth scheme, and status vocabulary for the PayPay OPA API. |
| `paypay://docs/payment-states` | Payment lifecycle and the cancel-vs-refund decision rule. |
| `paypay://config/current` | Non-secret view of the active config (env, merchantId, baseUrl, transport). |

## Install

One-click:

[![Install in Cursor](https://img.shields.io/badge/Install-Cursor-0A0A0A?logo=cursor)](cursor://anysphere.cursor-deeplink/mcp/install?name=paypay&config=eyJjb21tYW5kIjoibnB4IiwiYXJncyI6WyIteSIsInBheXBheS1tY3AiXX0=)
[![Install in VS Code](https://img.shields.io/badge/Install-VS_Code-007ACC?logo=visualstudiocode)](https://insiders.vscode.dev/redirect/mcp/install?name=paypay&config=%7B%22command%22%3A%22npx%22%2C%22args%22%3A%5B%22-y%22%2C%22paypay-mcp%22%5D%7D)

Or via npm:

```bash
npm install -g paypay-mcp
```

## Configuration

Credentials come from the [PayPay Developer Dashboard](https://developer.paypay.ne.jp/).

| Variable | Required | Description |
|---|---|---|
| `PAYPAY_API_KEY` | yes | OPA API Key ID |
| `PAYPAY_API_SECRET` | yes | OPA API Key Secret |
| `PAYPAY_MERCHANT_ID` | yes | Merchant ID |
| `PAYPAY_ENV` | no | `sandbox` (default) or `production` |
| `PAYPAY_ENABLE_REFUNDS` | no | Set to `true` to expose `refund_payment`. Disabled by default. |
| `PAYPAY_ENABLE_CANCELS` | no | Set to `true` to expose `cancel_payment`. Disabled by default. |
| `MCP_TRANSPORT` | no | `stdio` (default) or `http` |
| `MCP_HTTP_PORT` | no | Port when `MCP_TRANSPORT=http`. Default `3000`. |
| `MCP_HTTP_HOST` | no | Bind address. Default `127.0.0.1`. Public binds require `MCP_AUTH_TOKEN`. |
| `MCP_AUTH_TOKEN` | no | Bearer token required on inbound HTTP requests when set. Mandatory for non-loopback binds. |
| `MCP_HTTP_ALLOWED_ORIGINS` | no | Comma-separated CORS allowlist. Default: none. |

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

### Remote hosting

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

Endpoint: `POST http(s)://<host>:3000/mcp` (Streamable HTTP transport). Clients send `Authorization: Bearer <MCP_AUTH_TOKEN>`. CORS is closed by default.

For local testing the auth token can be omitted; the server binds to `127.0.0.1` and only accepts loopback connections.

## Environments

Sandbox is the default. Production requires PayPay merchant onboarding (business verification and a contract) and must be enabled by explicitly setting `PAYPAY_ENV=production`.

## Constraints

- Amounts are integer JPY.
- A payment can be canceled until 00:14:59 JST the day after the payment attempt. After that, use a refund.
- A single order can receive multiple partial refunds, each with a unique `merchantRefundId`, up to the merchant-configured cap.
- TLS 1.2+ required (Node 20+).

## Development

```bash
git clone https://github.com/mrslbt/paypay-mcp.git
cd paypay-mcp
npm install
cp .env.example .env
npm run dev
npm test
npm run smoke
npm run build
```

## Roadmap

v0.2: PreAuth + Capture, ContinuousPayments, DirectDebit, AccountLink QR, webhook signature verification, reconciliation tools.

v0.3: Native Payment (App Invoke + user JWT auth), Visa-partnership endpoints, OpenTelemetry tracing.

## Safety

This server can move real money through the PayPay OPA API. Key safeguards:

- **Refund and cancel tools are disabled by default.** `refund_payment` and `cancel_payment` are only registered when `PAYPAY_ENABLE_REFUNDS=true` or `PAYPAY_ENABLE_CANCELS=true`. Only enable them in trusted agent contexts where tool inputs cannot be influenced by untrusted content.
- **Sandbox is the default.** Production requires an explicit `PAYPAY_ENV=production`, plus completed PayPay merchant onboarding. Always test against sandbox first.
- **Unique merchantPaymentId and merchantRefundId per call.** PayPay deduplicates by these IDs, so reusing one will either fail or target an older payment. Generate a fresh ID for each new payment or refund.

Even with these gates on, review any money-moving request before approving the tool call. Treat tool inputs derived from model output as untrusted.

## Disclaimer

This is an unofficial, community-built MCP server. Not affiliated with, endorsed by, or sponsored by PayPay Corporation. PayPay is a registered trademark of its respective owners. Use at your own risk. The author accepts no liability for funds lost through misuse, prompt injection, or bugs.

## License

[MIT](LICENSE)
