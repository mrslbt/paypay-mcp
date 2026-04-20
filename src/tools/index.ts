/**
 * Tool registry. Money-reversing tools (refund, cancel) are opt-in
 * via environment variables so prompt injection cannot trigger them
 * by default.
 */

import type { Config } from "../config.js";
import { cancelPaymentTool } from "./cancel_payment.js";
import { createQrCodeTool } from "./create_qr_code.js";
import { deleteQrCodeTool } from "./delete_qr_code.js";
import { getPaymentDetailsTool } from "./get_payment_details.js";
import { refundPaymentTool } from "./refund_payment.js";
import { waitForPaymentTool } from "./wait_for_payment.js";
import type { ToolDefinition } from "./types.js";

export function getTools(config: Config): ToolDefinition<any>[] {
  const base: ToolDefinition<any>[] = [
    createQrCodeTool,
    getPaymentDetailsTool,
    waitForPaymentTool,
    deleteQrCodeTool,
  ];
  if (config.enableRefunds) base.push(refundPaymentTool);
  if (config.enableCancels) base.push(cancelPaymentTool);
  return base;
}

/** Every tool, regardless of gating. Used by tests and documentation. */
export const tools: ToolDefinition<any>[] = [
  createQrCodeTool,
  getPaymentDetailsTool,
  waitForPaymentTool,
  deleteQrCodeTool,
  refundPaymentTool,
  cancelPaymentTool,
];

export type { ToolDefinition } from "./types.js";
