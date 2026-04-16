/**
 * get_payment_details — fetch the current state of a payment.
 *
 * PayPay endpoint: GET /v2/codes/payments/{merchantPaymentId}
 */

import { z } from "zod";
import { textResult, type ToolDefinition } from "./types.js";

const input = z.object({
  merchant_payment_id: z
    .string()
    .describe("The merchantPaymentId used when creating the QR code. QR作成時のmerchantPaymentId。"),
});

export const getPaymentDetailsTool: ToolDefinition<typeof input> = {
  name: "get_payment_details",
  title: "Get PayPay Payment Details",
  description: [
    "Fetch the current status and details of a payment by merchantPaymentId.",
    "Returns status: CREATED | AUTHORIZED | COMPLETED | REFUNDED | FAILED | CANCELED.",
    "Use this for one-off status checks. For active polling, prefer `wait_for_payment`.",
    "",
    "merchantPaymentIdで指定した取引の現在のステータスと詳細を取得します。",
    "ステータス: CREATED / AUTHORIZED / COMPLETED / REFUNDED / FAILED / CANCELED。",
    "単発の確認に使用してください。継続的な確認は `wait_for_payment` を推奨します。",
  ].join("\n"),
  inputSchema: input,
  async handler(args, client) {
    const res = await client.request<{
      status: string;
      acceptedAt?: number;
      refunds?: { data: unknown[] };
      merchantPaymentId?: string;
      amount?: { amount: number; currency: string };
      paymentId?: string;
      orderDescription?: string;
    }>({
      method: "GET",
      path: `/v2/codes/payments/${encodeURIComponent(args.merchant_payment_id)}`,
    });

    const data = res.data!;
    // Pre-payment (status=CREATED) responses omit most fields and return
    // acceptedAt=0. Fall back to the input id, hide zero timestamps.
    const lines = [
      `merchantPaymentId: ${data.merchantPaymentId ?? args.merchant_payment_id}`,
      `status:            ${data.status}`,
      data.amount
        ? `amount:            ¥${data.amount.amount.toLocaleString("ja-JP")}`
        : null,
      data.paymentId ? `paymentId:         ${data.paymentId}` : null,
      data.acceptedAt && data.acceptedAt > 0
        ? `acceptedAt:        ${new Date(data.acceptedAt * 1000).toISOString()}`
        : null,
      data.orderDescription ? `orderDescription:  ${data.orderDescription}` : null,
      data.refunds?.data?.length
        ? `refunds:           ${data.refunds.data.length}`
        : null,
    ].filter(Boolean);

    return textResult(lines.join("\n"));
  },
};
