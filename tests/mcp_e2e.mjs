#!/usr/bin/env node
/**
 * MCP protocol end-to-end test — spawns the compiled server over stdio,
 * connects an MCP Client, lists tools/prompts, calls create_qr_code
 * against the PayPay sandbox, validates the image result, then cleans up
 * with delete_qr_code.
 *
 * Run with:  node --env-file-if-exists=.env tests/mcp_e2e.mjs
 */

import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";

function fail(msg) {
  console.error(`[e2e] ❌ ${msg}`);
  process.exit(1);
}

function ok(msg) {
  console.log(`[e2e] ✅ ${msg}`);
}

const transport = new StdioClientTransport({
  command: "node",
  args: ["dist/index.js"],
  env: {
    ...process.env,
    MCP_TRANSPORT: "stdio",
  },
});

const client = new Client({ name: "paypay-mcp-e2e", version: "0.0.0" }, { capabilities: {} });

console.log("[e2e] connecting to server over stdio…");
await client.connect(transport);
ok("connected");

// 1. List tools — refund_payment and cancel_payment are gated behind
// PAYPAY_ENABLE_REFUNDS / PAYPAY_ENABLE_CANCELS for safety, so we
// only expect them when those flags are on.
const toolsResp = await client.listTools();
const toolNames = toolsResp.tools.map((t) => t.name).sort();
console.log(`[e2e] tools: ${toolNames.join(", ")}`);

const expectedTools = [
  "create_qr_code",
  "delete_qr_code",
  "get_payment_details",
  "wait_for_payment",
];
if (process.env.PAYPAY_ENABLE_REFUNDS === "true") expectedTools.push("refund_payment");
if (process.env.PAYPAY_ENABLE_CANCELS === "true") expectedTools.push("cancel_payment");

for (const t of expectedTools) {
  if (!toolNames.includes(t)) fail(`missing tool: ${t}`);
}
// The inverse: if a tool is gated off, it must NOT appear.
if (process.env.PAYPAY_ENABLE_REFUNDS !== "true" && toolNames.includes("refund_payment")) {
  fail("refund_payment leaked through gating");
}
if (process.env.PAYPAY_ENABLE_CANCELS !== "true" && toolNames.includes("cancel_payment")) {
  fail("cancel_payment leaked through gating");
}
ok(`tool surface matches gating (${toolNames.length} tools)`);

// Verify bilingual descriptions (JP chars present)
const createTool = toolsResp.tools.find((t) => t.name === "create_qr_code");
if (!createTool?.description || !/[\u3040-\u30ff\u4e00-\u9fff]/.test(createTool.description)) {
  fail("create_qr_code description missing Japanese");
}
ok("create_qr_code description is bilingual (JP chars present)");

// 2. List prompts — also gated. refund_last_payment needs PAYPAY_ENABLE_REFUNDS.
// debug_stuck_payment needs PAYPAY_ENABLE_REFUNDS AND PAYPAY_ENABLE_CANCELS.
const promptsResp = await client.listPrompts();
const promptNames = promptsResp.prompts.map((p) => p.name).sort();
console.log(`[e2e] prompts: ${promptNames.join(", ")}`);

const expectedPrompts = ["accept_single_payment"];
if (process.env.PAYPAY_ENABLE_REFUNDS === "true") {
  expectedPrompts.push("refund_last_payment");
  if (process.env.PAYPAY_ENABLE_CANCELS === "true") {
    expectedPrompts.push("debug_stuck_payment");
  }
}
for (const p of expectedPrompts) {
  if (!promptNames.includes(p)) fail(`missing prompt: ${p}`);
}
ok(`prompt surface matches gating (${promptNames.length} prompts)`);

// 3. Call create_qr_code against sandbox
console.log("[e2e] calling create_qr_code…");
const created = await client.callTool({
  name: "create_qr_code",
  arguments: {
    amount: 1,
    order_description: "paypay-mcp MCP E2E test",
  },
});

if (created.isError) fail(`create_qr_code returned error: ${JSON.stringify(created.content)}`);
const textBlock = created.content.find((c) => c.type === "text");
const imageBlock = created.content.find((c) => c.type === "image");
if (!textBlock) fail("no text block in create_qr_code result");
if (!imageBlock) fail("no image block in create_qr_code result");
if (imageBlock.mimeType !== "image/png") fail(`image mimeType is ${imageBlock.mimeType}, want image/png`);
if (!imageBlock.data || imageBlock.data.length < 100) fail("image data looks empty");
ok(`create_qr_code returned text + PNG image (${imageBlock.data.length} b64 chars)`);

// Pull merchantPaymentId + codeId out of the text summary
const mpidMatch = textBlock.text.match(/merchantPaymentId:\s*(\S+)/);
const codeIdMatch = textBlock.text.match(/codeId:\s*(\S+)/);
if (!mpidMatch) fail("couldn't extract merchantPaymentId from result");
if (!codeIdMatch) fail("couldn't extract codeId from result");
const merchantPaymentId = mpidMatch[1];
const codeId = codeIdMatch[1];
console.log(`[e2e] merchantPaymentId=${merchantPaymentId} codeId=${codeId}`);

// 4. get_payment_details on freshly created QR (should be CREATED)
console.log("[e2e] calling get_payment_details…");
const details = await client.callTool({
  name: "get_payment_details",
  arguments: { merchant_payment_id: merchantPaymentId },
});
if (details.isError) fail(`get_payment_details error: ${JSON.stringify(details.content)}`);
const detailsText = details.content.find((c) => c.type === "text")?.text ?? "";
console.log(`[e2e]   details:\n${detailsText.split("\n").map((l) => "      " + l).join("\n")}`);
if (!detailsText.includes("status:")) fail("get_payment_details result missing status field");
ok("get_payment_details round-trip");

// 5. Clean up with delete_qr_code (takes codeId, not merchantPaymentId)
console.log("[e2e] calling delete_qr_code…");
const deleted = await client.callTool({
  name: "delete_qr_code",
  arguments: { code_id: codeId },
});
if (deleted.isError) fail(`delete_qr_code error: ${JSON.stringify(deleted.content)}`);
ok("delete_qr_code cleanup");

// 6. Invalid input → server-side validation error
console.log("[e2e] calling create_qr_code with invalid args (negative amount)…");
let gotValidationError = false;
try {
  const bad = await client.callTool({
    name: "create_qr_code",
    arguments: { amount: -1, order_description: "should fail" },
  });
  if (bad.isError) gotValidationError = true;
} catch (err) {
  gotValidationError = true;
}
if (!gotValidationError) fail("negative amount was NOT rejected");
ok("negative amount rejected by zod schema");

await client.close();
ok("MCP E2E test passed");
