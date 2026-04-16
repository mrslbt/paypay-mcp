/**
 * Tool registry — the canonical list of MCP tools this server exposes.
 */

import { cancelPaymentTool } from "./cancel_payment.js";
import { createQrCodeTool } from "./create_qr_code.js";
import { deleteQrCodeTool } from "./delete_qr_code.js";
import { getPaymentDetailsTool } from "./get_payment_details.js";
import { refundPaymentTool } from "./refund_payment.js";
import { waitForPaymentTool } from "./wait_for_payment.js";
import type { ToolDefinition } from "./types.js";

export const tools: ToolDefinition<any>[] = [
  createQrCodeTool,
  getPaymentDetailsTool,
  waitForPaymentTool,
  deleteQrCodeTool,
  refundPaymentTool,
  cancelPaymentTool,
];

export type { ToolDefinition } from "./types.js";
