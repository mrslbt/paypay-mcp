/**
 * MCP resources — read-only context the LLM can pull on demand.
 *
 * Kept intentionally static: the server is stateless and does not cache
 * per-session payment history. The resources here encode domain knowledge
 * that tools cannot convey (state machines, endpoint map, current env).
 */

import type { Config } from "../config.js";

export interface Resource {
  uri: string;
  name: string;
  title: string;
  description: string;
  mimeType: string;
  read: (config: Config) => string;
}

const OPA_REFERENCE = `# PayPay Open Payment API — Quick Reference

Base URLs:
- Sandbox:    https://apigw.sandbox.paypay.ne.jp
- Production: https://apigw.paypay.ne.jp

## Dynamic QR Code (\`v2/codes\`)
- POST    /v2/codes                        — create QR (merchantPaymentId required)
- DELETE  /v2/codes/{codeId}               — invalidate QR before payment
- GET     /v2/codes/payments/{merchantPaymentId} — payment status

## Refund (\`v2/refunds\`)
- POST /v2/refunds              — create refund (needs paymentId + merchantRefundId)
- GET  /v2/refunds/{merchantRefundId}

## Cancel
- DELETE /v2/payments/{merchantPaymentId}  — cancel while state is unclear;
  PayPay guarantees any taken funds are refunded if used within the window.

## Auth
HMAC-SHA256 signature over (method + path + body-hash + content-type + nonce + timestamp),
header \`Authorization: hmac OPA-Auth:<apiKey>:<sig>:<nonce>:<ts>:<bodyHash>\`.
Also required: \`X-ASSUME-MERCHANT\` header = merchantId.

## Status values
CREATED, AUTHORIZED, COMPLETED, REFUNDED, FAILED, CANCELED, EXPIRED.
`;

const PAYMENT_STATES = `# PayPay Payment State Machine

\`\`\`
CREATED ──(customer scans & approves)──▶ COMPLETED
   │                                         │
   │                                         ├──(refund_payment)──▶ REFUNDED (full)
   │                                         │                      │
   │                                         │                      └──▶ COMPLETED (partial refund, balance remains)
   │
   ├──(delete_qr_code, before payment)──▶ (code invalidated)
   ├──(timeout, no scan)─────────────────▶ EXPIRED
   └──(cancel_payment, unclear state)────▶ CANCELED
\`\`\`

## Cancel vs refund — which one?

- **Unclear state** (timeout, network error, ambiguous response): use \`cancel_payment\`.
  Valid until 00:14:59 JST the day after the attempt. PayPay guarantees taken funds
  are refunded.
- **Confirmed COMPLETED, after the cancel window**: use \`refund_payment\`. Each refund
  needs a unique \`merchantRefundId\`. Multiple partial refunds allowed up to the
  merchant-configured cap.

## Terminal states
COMPLETED, REFUNDED, FAILED, CANCELED, EXPIRED. \`wait_for_payment\` polls until one
of these is reached or the caller's timeout fires.
`;

export const resources: Resource[] = [
  {
    uri: "paypay://docs/opa-reference",
    name: "opa_reference",
    title: "PayPay OPA API Reference",
    description:
      "Endpoint map, base URLs, auth scheme, and status vocabulary for the PayPay Open Payment API.",
    mimeType: "text/markdown",
    read: () => OPA_REFERENCE,
  },
  {
    uri: "paypay://docs/payment-states",
    name: "payment_states",
    title: "Payment State Machine",
    description:
      "PayPay payment lifecycle and the cancel-vs-refund decision rule, including the 00:14:59 JST window.",
    mimeType: "text/markdown",
    read: () => PAYMENT_STATES,
  },
  {
    uri: "paypay://config/current",
    name: "current_config",
    title: "Current Server Configuration",
    description:
      "Non-secret view of the active config: environment, merchant ID, base URL, transport. Credentials are never exposed.",
    mimeType: "application/json",
    read: (config) =>
      JSON.stringify(
        {
          env: config.env,
          merchantId: config.merchantId,
          baseUrl: config.baseUrl,
          transport: config.transport,
        },
        null,
        2,
      ),
  },
];
