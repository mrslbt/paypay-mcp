import { describe, expect, it } from "vitest";
import { runHttp } from "../src/transports/http.js";

describe("HTTP transport security", () => {
  it("refuses to start without MCP_AUTH_TOKEN", async () => {
    await expect(
      runHttp({
        apiKey: "a_TEST",
        apiSecret: "secret",
        merchantId: "m_TEST",
        env: "sandbox",
        baseUrl: "https://apigw.sandbox.paypay.ne.jp",
        transport: "http",
        httpPort: 3000,
        httpHost: "127.0.0.1",
        httpAllowedOrigins: [],
      }),
    ).rejects.toThrow(/MCP_AUTH_TOKEN/);
  });
});
