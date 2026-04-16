/**
 * create_qr_code — creates a dynamic PayPay QR code for a single payment.
 *
 * PayPay endpoint: POST /v2/codes
 * Docs: https://www.paypay.ne.jp/opa/doc/v1.0/dynamicqrcode
 */

import { randomUUID } from "node:crypto";
import QRCode from "qrcode";
import { z } from "zod";
import { imageResult, type ToolDefinition } from "./types.js";

const input = z.object({
  amount: z
    .number()
    .int()
    .positive()
    .describe("Amount in JPY (integer, no decimals). 金額(円、整数)。"),
  order_description: z
    .string()
    .max(255)
    .describe("What the customer is paying for. 注文内容。"),
  merchant_payment_id: z
    .string()
    .max(64)
    .optional()
    .describe(
      "Unique ID for this payment. Auto-generated (UUID) if omitted. Reusing an ID for a different order will fail. 注文ごとの一意のID。省略時は自動生成。",
    ),
  code_type: z
    .enum(["ORDER_QR"])
    .default("ORDER_QR")
    .describe("QR code type. Currently only ORDER_QR is supported."),
  redirect_url: z
    .string()
    .url()
    .optional()
    .describe("Where to send the user after they complete payment in the PayPay app."),
  redirect_type: z
    .enum(["WEB_LINK", "APP_DEEP_LINK"])
    .optional()
    .describe("How the redirect should open: browser (WEB_LINK) or app (APP_DEEP_LINK)."),
  is_authorization: z
    .boolean()
    .default(false)
    .describe("If true, this is a pre-auth (hold funds now, capture later). 事前承認(preauth)フラグ。"),
  order_items: z
    .array(
      z.object({
        name: z.string(),
        category: z.string().optional(),
        quantity: z.number().int().positive().default(1),
        productId: z.string().optional(),
        unit_price: z.object({
          amount: z.number().int().positive(),
          currency: z.literal("JPY").default("JPY"),
        }),
      }),
    )
    .optional()
    .describe("Optional line-item breakdown shown in the PayPay app. 商品明細(任意)。"),
});

export const createQrCodeTool: ToolDefinition<typeof input> = {
  name: "create_qr_code",
  title: "Create PayPay QR Code",
  description: [
    "Create a dynamic PayPay QR code that a customer can scan to pay.",
    "Returns the QR code both as a URL (deeplink + hosted image) and as an inline PNG image.",
    "Use `wait_for_payment` to poll until the customer completes the payment.",
    "",
    "顧客がスキャンして支払うためのPayPay動的QRコードを作成します。",
    "QRコードのURL(ディープリンクとホストされた画像)とインラインPNG画像の両方を返します。",
    "顧客が支払いを完了するまで `wait_for_payment` でポーリングしてください。",
  ].join("\n"),
  inputSchema: input,
  async handler(args, client) {
    const merchantPaymentId = args.merchant_payment_id ?? randomUUID();

    const body = {
      merchantPaymentId,
      codeType: args.code_type,
      amount: { amount: args.amount, currency: "JPY" },
      orderDescription: args.order_description,
      isAuthorization: args.is_authorization,
      ...(args.redirect_url ? { redirectUrl: args.redirect_url } : {}),
      ...(args.redirect_type ? { redirectType: args.redirect_type } : {}),
      ...(args.order_items
        ? {
            orderItems: args.order_items.map((it) => ({
              name: it.name,
              category: it.category,
              quantity: it.quantity,
              productId: it.productId,
              unitPrice: { amount: it.unit_price.amount, currency: "JPY" },
            })),
          }
        : {}),
      redirectType: args.redirect_type ?? "WEB_LINK",
      requestedAt: Math.floor(Date.now() / 1000),
    } as const;

    const res = await client.request<{
      codeId: string;
      url: string;
      deeplink: string;
      expiryDate: number;
      merchantPaymentId: string;
      amount: { amount: number; currency: string };
    }>({
      method: "POST",
      path: "/v2/codes",
      body,
    });

    const data = res.data!;
    const png = await QRCode.toBuffer(data.url, { errorCorrectionLevel: "M", width: 512 });

    const summary = [
      `PayPay QR code created.`,
      `merchantPaymentId: ${data.merchantPaymentId}`,
      `codeId:            ${data.codeId}`,
      `amount:            ¥${data.amount.amount.toLocaleString("ja-JP")}`,
      `expires at:        ${new Date(data.expiryDate * 1000).toISOString()}`,
      `payment URL:       ${data.url}`,
      `deeplink:          ${data.deeplink}`,
      ``,
      `Next step: call \`wait_for_payment\` with merchantPaymentId="${data.merchantPaymentId}".`,
    ].join("\n");

    return imageResult(summary, png);
  },
};
