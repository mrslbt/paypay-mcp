/**
 * cancel_payment — cancel a payment that is still in-flight.
 *
 * PayPay endpoint: DELETE /v2/payments/{merchantPaymentId}
 *
 * Usage: when you initiated a payment and the client got a timeout/unclear
 * response, call this to guarantee the money (if taken) is refunded to the
 * user's wallet. Window: until 00:14:59 AM JST the day after payment.
 */

import { z } from "zod";
import { textResult, type ToolDefinition } from "./types.js";

const input = z.object({
  merchant_payment_id: z
    .string()
    .describe("The merchantPaymentId of the payment to cancel."),
});

export const cancelPaymentTool: ToolDefinition<typeof input> = {
  name: "cancel_payment",
  title: "Cancel PayPay Payment",
  description: [
    "Cancel a payment where the client could not determine the final state (timeout, network error, ambiguous response).",
    "PayPay guarantees that if the money was taken, it will be returned to the user's wallet.",
    "Window: until 00:14:59 AM JST the day after the payment attempt. Outside that window, use refund_payment instead.",
    "",
    "決済のステータスを確認できなかった場合(タイムアウト、通信エラー、不明なレスポンス等)、取引をキャンセルします。",
    "金額が引き落とされていた場合、PayPayがユーザーのウォレットに返金することを保証します。",
    "可能な時間帯: 決済日翌日の午前00:14:59(JST)まで。それ以降は refund_payment を使用してください。",
  ].join("\n"),
  inputSchema: input,
  async handler(args, client) {
    await client.request({
      method: "DELETE",
      path: `/v2/payments/${encodeURIComponent(args.merchant_payment_id)}`,
    });
    return textResult(`Payment ${args.merchant_payment_id} canceled.`);
  },
};
