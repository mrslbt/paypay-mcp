import { describe, expect, it } from "vitest";
import { sign } from "../src/auth.js";

describe("PayPay HMAC auth", () => {
  it("produces an Authorization header matching the OPA-Auth format (POST w/ body)", () => {
    const { Authorization, "Content-Type": contentType } = sign({
      apiKey: "a_TEST",
      apiSecret: "secret123",
      method: "POST",
      resourceUrl: "/v2/codes",
      body: JSON.stringify({ hello: "world" }),
    });

    expect(contentType).toBe("application/json");
    // hmac OPA-Auth:<clientId>:<macData>:<nonce>:<epoch>:<payloadDigest>
    expect(Authorization).toMatch(
      /^hmac OPA-Auth:a_TEST:[A-Za-z0-9+/=]+:[0-9a-f-]{36}:\d+:[A-Za-z0-9+/=]+$/,
    );
  });

  it('signs empty-body requests with "empty" markers and omits Content-Type', () => {
    const headers = sign({
      apiKey: "a_TEST",
      apiSecret: "secret123",
      method: "GET",
      resourceUrl: "/v2/codes/payments/xyz",
      body: undefined,
    });
    expect(headers["Content-Type"]).toBeUndefined();
    // Last segment must be "empty" for empty-body requests.
    expect(headers.Authorization).toMatch(/:empty$/);
  });

  it("produces different macData for different bodies", () => {
    const base = {
      apiKey: "a_TEST",
      apiSecret: "secret123",
      method: "POST" as const,
      resourceUrl: "/v2/codes",
    };
    const a = sign({ ...base, body: JSON.stringify({ a: 1 }) });
    const b = sign({ ...base, body: JSON.stringify({ a: 2 }) });
    const macA = a.Authorization.split(":")[2];
    const macB = b.Authorization.split(":")[2];
    expect(macA).not.toBe(macB);
  });
});
