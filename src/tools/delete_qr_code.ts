/**
 * delete_qr_code — invalidate a QR code before it is paid.
 *
 * PayPay endpoint: DELETE /v2/codes/{codeId}
 */

import { z } from "zod";
import { textResult, type ToolDefinition } from "./types.js";

const input = z.object({
  code_id: z
    .string()
    .describe("The codeId returned from create_qr_code (NOT the merchantPaymentId). create_qr_codeで返されたcodeId。"),
});

export const deleteQrCodeTool: ToolDefinition<typeof input> = {
  name: "delete_qr_code",
  title: "Delete PayPay QR Code",
  description: [
    "Invalidate a QR code before it is paid. Cannot be used after payment has completed.",
    "Use this when an order is canceled before checkout, or to clean up expired codes.",
    "",
    "支払い前のQRコードを無効化します。決済完了後は使用できません。",
    "注文がキャンセルされた場合や、期限切れのコードを整理する際に使用してください。",
  ].join("\n"),
  inputSchema: input,
  async handler(args, client) {
    await client.request({
      method: "DELETE",
      path: `/v2/codes/${encodeURIComponent(args.code_id)}`,
    });
    return textResult(`QR code ${args.code_id} deleted.`);
  },
};
