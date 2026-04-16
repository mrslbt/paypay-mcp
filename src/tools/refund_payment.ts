/**
 * refund_payment — refund a completed PayPay payment.
 *
 * PayPay endpoint: POST /v2/refunds
 *
 * Constraints:
 *   - Each refund MUST use a unique merchantRefundId. Reusing one fails.
 *   - The total refunded amount cannot exceed the original payment amount.
 *   - Each merchant has a cap on the number of refunds per payment, configured
 *     by PayPay. Hitting the cap returns REFUND_LIMIT_EXCEEDED.
 */

import { randomUUID } from "node:crypto";
import { z } from "zod";
import { textResult, type ToolDefinition } from "./types.js";

const input = z.object({
  payment_id: z
    .string()
    .describe("The paymentId returned from get_payment_details. (NOT merchantPaymentId.) 決済時のpaymentId。"),
  amount: z
    .number()
    .int()
    .positive()
    .describe("Refund amount in JPY. Can be less than the original (partial refund). 返金額(円)。"),
  reason: z
    .string()
    .max(255)
    .optional()
    .describe("Reason for the refund, shown to the user. 返金理由。"),
  merchant_refund_id: z
    .string()
    .optional()
    .describe("Unique ID for this refund. Auto-generated if omitted."),
});

export const refundPaymentTool: ToolDefinition<typeof input> = {
  name: "refund_payment",
  title: "Refund PayPay Payment",
  description: [
    "Refund a completed PayPay payment, in full or in part.",
    "Multiple partial refunds on the same payment are allowed, as long as:",
    "  (1) each refund uses a unique merchantRefundId,",
    "  (2) the sum of refunds does not exceed the original amount,",
    "  (3) the merchant has not hit PayPay's per-payment refund cap (error: REFUND_LIMIT_EXCEEDED).",
    "",
    "完了したPayPay決済を全額または一部返金します。",
    "同一取引に対する複数回の部分返金が可能です。ただし:",
    "  (1) 各返金に一意のmerchantRefundIdが必要です。",
    "  (2) 返金合計額は元の取引金額を超えられません。",
    "  (3) マーチャントごとに設定された返金回数上限があります(超過時: REFUND_LIMIT_EXCEEDED)。",
  ].join("\n"),
  inputSchema: input,
  async handler(args, client) {
    const merchantRefundId = args.merchant_refund_id ?? randomUUID();

    const res = await client.request<{
      status: string;
      acceptedAt?: number;
      merchantRefundId: string;
      paymentId: string;
      amount: { amount: number; currency: string };
    }>({
      method: "POST",
      path: "/v2/refunds",
      body: {
        merchantRefundId,
        paymentId: args.payment_id,
        amount: { amount: args.amount, currency: "JPY" },
        reason: args.reason,
        requestedAt: Math.floor(Date.now() / 1000),
      },
    });

    const data = res.data!;
    return textResult(
      [
        `Refund accepted.`,
        `status:            ${data.status}`,
        `merchantRefundId:  ${data.merchantRefundId}`,
        `paymentId:         ${data.paymentId}`,
        `amount refunded:   ¥${data.amount.amount.toLocaleString("ja-JP")}`,
        data.acceptedAt
          ? `acceptedAt:        ${new Date(data.acceptedAt * 1000).toISOString()}`
          : null,
      ]
        .filter(Boolean)
        .join("\n"),
    );
  },
};
