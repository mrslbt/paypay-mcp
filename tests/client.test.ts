import { beforeEach, describe, expect, it, vi } from "vitest";
import { PayPayClient } from "../src/client.js";

describe("PayPayClient timeouts", () => {
  const config = {
    apiKey: "a_TEST",
    apiSecret: "secret",
    merchantId: "m_TEST",
    env: "sandbox" as const,
    baseUrl: "https://apigw.sandbox.paypay.ne.jp",
    transport: "stdio" as const,
    httpPort: 3000,
    httpHost: "127.0.0.1",
    httpAuthToken: undefined,
    httpAllowedOrigins: [],
  };

  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("keeps the timeout active while reading the response body", async () => {
    const fetchMock = vi.fn(async (_url: string, init?: RequestInit) => {
      const signal = init?.signal as AbortSignal;
      return {
        ok: true,
        status: 200,
        text: () =>
          new Promise<string>((_resolve, reject) => {
            signal.addEventListener(
              "abort",
              () => reject(Object.assign(new Error("aborted"), { name: "AbortError" })),
              { once: true },
            );
          }),
      } as Response;
    });
    vi.stubGlobal("fetch", fetchMock);

    const client = new PayPayClient(config);
    await expect(
      client.request({
        method: "GET",
        path: "/v2/codes/payments/test",
        timeoutMs: 25,
      }),
    ).rejects.toMatchObject({ code: "REQUEST_TIMEOUT", httpStatus: 0 });
  });
});
