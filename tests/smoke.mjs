#!/usr/bin/env node
/**
 * Sandbox smoke test — verifies HMAC signing + end-to-end API call by creating
 * a real QR code against PayPay's sandbox. Not run as part of `npm test`
 * because it requires real credentials.
 *
 * Run with:  node --env-file=.env tests/smoke.mjs
 */

import { randomUUID } from "node:crypto";
import { PayPayClient } from "../dist/client.js";
import { loadConfig } from "../dist/config.js";

const config = loadConfig();
console.log(`[smoke] env=${config.env} base=${config.baseUrl} merchant=${config.merchantId}`);

const client = new PayPayClient(config);
const merchantPaymentId = `smoke-${randomUUID()}`;
console.log(`[smoke] creating QR code, merchantPaymentId=${merchantPaymentId}`);

try {
  const res = await client.request({
    method: "POST",
    path: "/v2/codes",
    body: {
      merchantPaymentId,
      codeType: "ORDER_QR",
      amount: { amount: 1, currency: "JPY" },
      orderDescription: "paypay-mcp smoke test",
      isAuthorization: false,
      redirectType: "WEB_LINK",
      requestedAt: Math.floor(Date.now() / 1000),
    },
  });

  console.log("[smoke] ✅ SUCCESS");
  console.log(JSON.stringify(res, null, 2));

  // Clean up the QR we just made
  if (res.data?.codeId) {
    console.log(`[smoke] cleaning up codeId=${res.data.codeId}`);
    await client.request({
      method: "DELETE",
      path: `/v2/codes/${encodeURIComponent(res.data.codeId)}`,
    });
    console.log("[smoke] ✅ cleanup OK");
  }
} catch (err) {
  console.error("[smoke] ❌ FAILED");
  console.error(`code:        ${err.code}`);
  console.error(`httpStatus:  ${err.httpStatus}`);
  console.error(`message:     ${err.message}`);
  if (err.codeId) console.error(`codeId:      ${err.codeId}`);
  if (err.raw) console.error(`raw:         ${JSON.stringify(err.raw, null, 2)}`);
  process.exit(1);
}
