/**
 * MCP prompts: reusable conversation starters for common PayPay flows.
 *
 * Refund and debug prompts are only surfaced when the matching tools
 * are enabled via PAYPAY_ENABLE_REFUNDS / PAYPAY_ENABLE_CANCELS.
 */

import type { Config } from "../config.js";

export interface Prompt {
  name: string;
  title: string;
  description: string;
  text: string;
}

const acceptSinglePayment: Prompt = {
  name: "accept_single_payment",
  title: "Accept a single PayPay payment",
  description:
    "Walks through creating a QR code and waiting for the customer to pay. 単発の決済を受け付けるフロー。",
  text: `I want to accept a single PayPay payment.

Please:
1. Use \`create_qr_code\` with the amount and description I provide.
2. Show me the QR image so my customer can scan it.
3. Use \`wait_for_payment\` to poll until the payment completes or times out.
4. Report the final status clearly.

Ask me for the amount (JPY) and what the customer is paying for before starting.`,
};

const refundLastPayment: Prompt = {
  name: "refund_last_payment",
  title: "Refund a recent PayPay payment",
  description:
    "Refunds a payment by merchantPaymentId. Explains PayPay's multiple-refund constraints. 最近の決済を返金します。",
  text: `I want to refund a PayPay payment.

Please:
1. Ask me for the merchantPaymentId of the payment to refund.
2. Use \`get_payment_details\` to look it up and confirm the status and paymentId.
3. Explain that PayPay allows multiple refunds on the same payment as long as each refund uses a unique \`merchantRefundId\`, the refunded total does not exceed the original amount, and the merchant has not hit PayPay's per-payment refund cap.
4. Ask me whether to do a full or partial refund.
5. Use \`refund_payment\` with the paymentId and amount.
6. Report the result.`,
};

const debugStuckPayment: Prompt = {
  name: "debug_stuck_payment",
  title: "Debug a stuck or unclear payment",
  description:
    "Investigates a payment whose status is unclear and resolves it safely. ステータスが不明な決済を調査して解決します。",
  text: `A PayPay payment is in an unclear state (timeout, network error, or ambiguous response).

Please:
1. Ask me for the merchantPaymentId.
2. Use \`get_payment_details\` to check the current status.
3. If the status is CREATED (still unpaid), offer to either keep waiting with \`wait_for_payment\` or invalidate the QR with \`delete_qr_code\`.
4. If the status is indeterminate OR the window (00:14:59 JST next day) has not passed, recommend \`cancel_payment\`. PayPay will guarantee any taken funds are refunded.
5. If the window has passed and the payment is COMPLETED, recommend \`refund_payment\` instead.`,
};

export function getPrompts(config: Config): Prompt[] {
  const list: Prompt[] = [acceptSinglePayment];
  if (config.enableRefunds) list.push(refundLastPayment);
  if (config.enableRefunds && config.enableCancels) list.push(debugStuckPayment);
  return list;
}

export const prompts: Prompt[] = [acceptSinglePayment, refundLastPayment, debugStuckPayment];
