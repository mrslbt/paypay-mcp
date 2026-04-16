/**
 * Smoke tests: every tool is registered, each has a bilingual description,
 * and the input schemas parse sensible input.
 */

import { describe, expect, it } from "vitest";
import { tools } from "../src/tools/index.js";

describe("tool registry", () => {
  it("exposes the v0.1 tool set", () => {
    const names = tools.map((t) => t.name).sort();
    expect(names).toEqual(
      [
        "cancel_payment",
        "create_qr_code",
        "delete_qr_code",
        "get_payment_details",
        "refund_payment",
        "wait_for_payment",
      ].sort(),
    );
  });

  it("every tool ships bilingual JP/EN descriptions", () => {
    const jpRegex = /[\u3040-\u30ff\u4e00-\u9fff]/;
    for (const tool of tools) {
      expect(tool.description, `${tool.name} needs EN text`).toMatch(/[A-Za-z]{3,}/);
      expect(tool.description, `${tool.name} needs JP text`).toMatch(jpRegex);
      expect(tool.title.length).toBeGreaterThan(0);
    }
  });

  it("create_qr_code rejects zero/negative amounts", () => {
    const createQr = tools.find((t) => t.name === "create_qr_code")!;
    expect(() =>
      createQr.inputSchema.parse({ amount: 0, order_description: "x" }),
    ).toThrow();
    expect(() =>
      createQr.inputSchema.parse({ amount: -100, order_description: "x" }),
    ).toThrow();
  });

  it("create_qr_code accepts a minimal valid input", () => {
    const createQr = tools.find((t) => t.name === "create_qr_code")!;
    expect(() =>
      createQr.inputSchema.parse({ amount: 100, order_description: "Coffee" }),
    ).not.toThrow();
  });

  it("wait_for_payment enforces timeout bounds", () => {
    const wait = tools.find((t) => t.name === "wait_for_payment")!;
    expect(() =>
      wait.inputSchema.parse({ merchant_payment_id: "x", timeout_seconds: 4 }),
    ).toThrow();
    expect(() =>
      wait.inputSchema.parse({ merchant_payment_id: "x", timeout_seconds: 700 }),
    ).toThrow();
  });
});
