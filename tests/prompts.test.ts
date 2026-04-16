import { describe, expect, it } from "vitest";
import { prompts } from "../src/prompts/index.js";

describe("prompts", () => {
  it("refund prompt explains the current multiple-refund rules", () => {
    const refundPrompt = prompts.find((prompt) => prompt.name === "refund_last_payment");
    expect(refundPrompt).toBeDefined();
    expect(refundPrompt!.text).toContain("allows multiple refunds");
    expect(refundPrompt!.text).toContain("unique `merchantRefundId`");
    expect(refundPrompt!.text).not.toContain("only allows ONE refund per order");
  });
});
