import { describe, expect, it } from "vitest";
import { parsePayPayError } from "../src/errors.js";

describe("PayPay error parsing", () => {
  it("extracts the OPA error envelope and attaches bilingual hints", () => {
    const err = parsePayPayError(400, {
      resultInfo: {
        code: "DYNAMIC_QR_EXPIRED",
        message: "QR expired",
        codeId: "01400001",
      },
    });
    expect(err.code).toBe("DYNAMIC_QR_EXPIRED");
    expect(err.message).toBe("QR expired");
    expect(err.codeId).toBe("01400001");
    expect(err.hint?.en).toContain("expired");
    expect(err.hint?.ja).toContain("有効期限");
  });

  it("falls back to HTTP_<status> when no envelope is present", () => {
    const err = parsePayPayError(502, { something: "else" });
    expect(err.code).toBe("HTTP_502");
    expect(err.httpStatus).toBe(502);
  });

  it("formats a tool error string with bilingual hint lines", () => {
    const err = parsePayPayError(401, {
      resultInfo: { code: "UNAUTHORIZED", message: "bad creds", codeId: "x" },
    });
    const formatted = err.toToolError();
    expect(formatted).toContain("UNAUTHORIZED");
    expect(formatted).toContain("Hint (EN)");
    expect(formatted).toContain("ヒント (JA)");
  });
});
