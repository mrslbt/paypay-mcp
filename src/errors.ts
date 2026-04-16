/**
 * PayPay OPA error taxonomy.
 *
 * PayPay returns errors in a consistent envelope:
 *   { resultInfo: { code, message, codeId } }
 *
 * We normalize these into a single class with JP+EN messages so MCP clients
 * can surface localized errors naturally.
 */

export interface PayPayErrorEnvelope {
  code?: string;
  message?: string;
  codeId?: string;
}

interface BilingualHint {
  en: string;
  ja: string;
}

/**
 * Friendly hints for the most common OPA error codes.
 * Not exhaustive — the raw `code` and `message` from PayPay are always preserved.
 */
const HINTS: Record<string, BilingualHint> = {
  DYNAMIC_QR_EXPIRED: {
    en: "The QR code has expired. Create a new one.",
    ja: "QRコードの有効期限が切れています。新しく作成してください。",
  },
  DYNAMIC_QR_ALREADY_USED: {
    en: "This QR code has already been paid.",
    ja: "このQRコードはすでに支払い済みです。",
  },
  DUPLICATE_DYNAMIC_QR_REQUEST: {
    en: "Duplicate merchantPaymentId. Use a unique ID for each order.",
    ja: "merchantPaymentIdが重複しています。注文ごとに一意のIDを指定してください。",
  },
  INVALID_REQUEST_PARAMS: {
    en: "Invalid request parameters. Check amount, codeType, and merchantPaymentId.",
    ja: "リクエストパラメータが不正です。金額、codeType、merchantPaymentIdを確認してください。",
  },
  UNAUTHORIZED: {
    en: "Authentication failed. Check PAYPAY_API_KEY / PAYPAY_API_SECRET and PAYPAY_ENV.",
    ja: "認証に失敗しました。PAYPAY_API_KEY / PAYPAY_API_SECRET / PAYPAY_ENVを確認してください。",
  },
  TRANSACTION_NOT_FOUND: {
    en: "No transaction found for that merchantPaymentId.",
    ja: "指定されたmerchantPaymentIdの取引が見つかりません。",
  },
  REFUND_NOT_ALLOWED: {
    en: "This payment cannot be refunded (outside the refund window, or payment state does not permit it).",
    ja: "この取引は返金できません(返金可能期間外、または決済状態が返金に対応していません)。",
  },
  REFUND_LIMIT_EXCEEDED: {
    en: "This payment has reached PayPay's per-order refund count limit for this merchant.",
    ja: "この取引はPayPayの加盟店あたりの返金回数上限に達しました。",
  },
  DUPLICATE_REFUND_ID: {
    en: "merchantRefundId has already been used. Generate a new unique ID for each refund.",
    ja: "merchantRefundIdが既に使用されています。返金ごとに一意のIDを指定してください。",
  },
};

export class PayPayError extends Error {
  readonly code: string;
  readonly codeId?: string;
  readonly httpStatus: number;
  readonly hint?: BilingualHint;
  readonly raw: unknown;

  constructor(args: {
    code: string;
    message: string;
    codeId?: string;
    httpStatus: number;
    raw: unknown;
  }) {
    super(args.message);
    this.name = "PayPayError";
    this.code = args.code;
    this.codeId = args.codeId;
    this.httpStatus = args.httpStatus;
    this.hint = HINTS[args.code];
    this.raw = args.raw;
  }

  /** Serialize for an MCP tool response — includes bilingual hint when available. */
  toToolError(): string {
    const parts = [
      `PayPay error (${this.code}): ${this.message}`,
      this.codeId ? `codeId: ${this.codeId}` : null,
      this.hint ? `Hint (EN): ${this.hint.en}` : null,
      this.hint ? `ヒント (JA): ${this.hint.ja}` : null,
    ].filter(Boolean);
    return parts.join("\n");
  }
}

export function parsePayPayError(
  httpStatus: number,
  body: unknown,
): PayPayError {
  const envelope = (body as { resultInfo?: PayPayErrorEnvelope })?.resultInfo;
  return new PayPayError({
    code: envelope?.code ?? `HTTP_${httpStatus}`,
    message: envelope?.message ?? `PayPay API error (HTTP ${httpStatus})`,
    codeId: envelope?.codeId,
    httpStatus,
    raw: body,
  });
}
