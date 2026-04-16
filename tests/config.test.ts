import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { loadConfig } from "../src/config.js";

describe("loadConfig", () => {
  const saved = { ...process.env };
  beforeEach(() => {
    for (const k of Object.keys(process.env)) {
      if (k.startsWith("PAYPAY_") || k.startsWith("MCP_")) delete process.env[k];
    }
  });
  afterEach(() => {
    process.env = { ...saved };
  });

  it("throws a helpful error when API key is missing", () => {
    expect(() => loadConfig()).toThrow(/PAYPAY_API_KEY/);
  });

  it("defaults to sandbox + stdio with valid creds", () => {
    process.env.PAYPAY_API_KEY = "a_TEST";
    process.env.PAYPAY_API_SECRET = "secret";
    process.env.PAYPAY_MERCHANT_ID = "m_TEST";
    const c = loadConfig();
    expect(c.env).toBe("sandbox");
    expect(c.baseUrl).toBe("https://apigw.sandbox.paypay.ne.jp");
    expect(c.transport).toBe("stdio");
  });

  it("switches base URL for production", () => {
    process.env.PAYPAY_API_KEY = "a_TEST";
    process.env.PAYPAY_API_SECRET = "secret";
    process.env.PAYPAY_MERCHANT_ID = "m_TEST";
    process.env.PAYPAY_ENV = "production";
    const c = loadConfig();
    expect(c.env).toBe("production");
    expect(c.baseUrl).toBe("https://apigw.paypay.ne.jp");
  });

  it("rejects invalid env values", () => {
    process.env.PAYPAY_API_KEY = "a_TEST";
    process.env.PAYPAY_API_SECRET = "secret";
    process.env.PAYPAY_MERCHANT_ID = "m_TEST";
    process.env.PAYPAY_ENV = "staging";
    expect(() => loadConfig()).toThrow(/sandbox.*production/);
  });
});
