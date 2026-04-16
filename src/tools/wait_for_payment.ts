/**
 * wait_for_payment — poll GET /v2/codes/payments/{id} until the payment
 * reaches a terminal state or the timeout elapses.
 *
 * This is one of the MCP's core differentiators: most payment MCPs force
 * the agent to implement its own polling loop. We wrap it into one tool.
 */

import { z } from "zod";
import { textResult, type ToolDefinition } from "./types.js";

const TERMINAL_STATUSES = new Set([
  "COMPLETED",
  "AUTHORIZED",
  "REFUNDED",
  "FAILED",
  "CANCELED",
]);

const input = z.object({
  merchant_payment_id: z
    .string()
    .describe("The merchantPaymentId of the payment to wait on."),
  timeout_seconds: z
    .number()
    .int()
    .min(5)
    .max(600)
    .default(120)
    .describe("Give up after this many seconds. Default: 120."),
  poll_interval_seconds: z
    .number()
    .min(1)
    .max(10)
    .default(3)
    .describe("How often to poll (seconds). PayPay recommends 2–3s."),
});

export const waitForPaymentTool: ToolDefinition<typeof input> = {
  name: "wait_for_payment",
  title: "Wait for PayPay Payment",
  description: [
    "Poll PayPay until a payment reaches a terminal state (COMPLETED, AUTHORIZED, REFUNDED, FAILED, CANCELED) or the timeout elapses.",
    "Uses PayPay's recommended 2–3s polling interval by default.",
    "Returns the final status and full payment detail.",
    "",
    "取引が終了状態(COMPLETED / AUTHORIZED / REFUNDED / FAILED / CANCELED)に達するかタイムアウトするまで、PayPayをポーリングします。",
    "PayPay推奨の2〜3秒間隔をデフォルトで使用します。",
    "最終ステータスと取引詳細を返します。",
  ].join("\n"),
  inputSchema: input,
  async handler(args, client) {
    const deadline = Date.now() + args.timeout_seconds * 1000;
    const intervalMs = args.poll_interval_seconds * 1000;
    let attempts = 0;
    let lastStatus: string | undefined;
    let lastData: Record<string, unknown> | undefined;

    while (Date.now() < deadline) {
      attempts += 1;
      const remainingMs = Math.max(1000, deadline - Date.now());
      const res = await client.request<{
        status: string;
        merchantPaymentId: string;
        amount: { amount: number; currency: string };
        paymentId?: string;
        acceptedAt?: number;
      }>({
        method: "GET",
        path: `/v2/codes/payments/${encodeURIComponent(args.merchant_payment_id)}`,
        timeoutMs: Math.min(remainingMs, 10_000),
      });

      lastStatus = res.data?.status;
      lastData = res.data as unknown as Record<string, unknown>;

      if (lastStatus && TERMINAL_STATUSES.has(lastStatus)) {
        return textResult(
          [
            `Payment reached terminal status: ${lastStatus}`,
            `attempts:          ${attempts}`,
            `merchantPaymentId: ${args.merchant_payment_id}`,
            lastData?.paymentId ? `paymentId:         ${lastData.paymentId}` : null,
            res.data?.amount
              ? `amount:            ¥${res.data.amount.amount.toLocaleString("ja-JP")}`
              : null,
            res.data?.acceptedAt
              ? `acceptedAt:        ${new Date(res.data.acceptedAt * 1000).toISOString()}`
              : null,
          ]
            .filter(Boolean)
            .join("\n"),
        );
      }

      await sleep(intervalMs);
    }

    return textResult(
      [
        `Timeout: payment did not reach a terminal status within ${args.timeout_seconds}s.`,
        `attempts:          ${attempts}`,
        `merchantPaymentId: ${args.merchant_payment_id}`,
        `last status:       ${lastStatus ?? "(never responded)"}`,
        ``,
        `The QR code may still be unpaid. Call get_payment_details later, or delete_qr_code to invalidate it.`,
      ].join("\n"),
    );
  },
};

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
