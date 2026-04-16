/**
 * Thin PayPay OPA REST client.
 *
 * Handles:
 *   - HMAC-SHA256 auth header construction
 *   - JSON body serialization
 *   - Error envelope parsing (throws PayPayError)
 *   - X-ASSUME-MERCHANT header injection
 */

import { sign } from "./auth.js";
import type { Config } from "./config.js";
import { parsePayPayError, PayPayError } from "./errors.js";
import { logger } from "./logger.js";

export interface RequestOptions {
  method: "GET" | "POST" | "DELETE";
  path: string;
  body?: unknown;
  /** Override Merchant-ID for the call (rarely needed). */
  merchantId?: string;
  /** Hard timeout for this request in ms. Defaults to 15s. */
  timeoutMs?: number;
  /** External abort signal. Combined with the internal timeout. */
  signal?: AbortSignal;
}

export interface PayPayResponse<T = unknown> {
  resultInfo: {
    code: string;
    message: string;
    codeId: string;
  };
  data?: T;
}

export class PayPayClient {
  constructor(private readonly config: Config) {}

  async request<T = unknown>(
    opts: RequestOptions,
  ): Promise<PayPayResponse<T>> {
    const body = opts.body !== undefined ? JSON.stringify(opts.body) : undefined;

    const signedHeaders = sign({
      apiKey: this.config.apiKey,
      apiSecret: this.config.apiSecret,
      method: opts.method,
      resourceUrl: opts.path,
      body,
    });

    const url = this.config.baseUrl + opts.path;
    const merchantId = opts.merchantId ?? this.config.merchantId;

    logger.debug("PayPay request", {
      method: opts.method,
      url,
      merchantId,
      hasBody: body !== undefined,
    });

    const headers: Record<string, string> = {
      Authorization: signedHeaders.Authorization,
      "X-ASSUME-MERCHANT": merchantId,
    };
    if (signedHeaders["Content-Type"]) {
      headers["Content-Type"] = signedHeaders["Content-Type"];
    }

    const timeoutMs = opts.timeoutMs ?? 15_000;
    const controller = new AbortController();
    let timedOut = false;
    const timer = setTimeout(() => {
      timedOut = true;
      controller.abort();
    }, timeoutMs);
    const forwardAbort = () => controller.abort(opts.signal?.reason);
    if (opts.signal) {
      if (opts.signal.aborted) forwardAbort();
      else opts.signal.addEventListener("abort", forwardAbort, { once: true });
    }

    let response: Response;
    let text: string;
    try {
      response = await fetch(url, {
        method: opts.method,
        headers,
        body,
        signal: controller.signal,
      });
      text = await response.text();
    } catch (err) {
      if ((err as { name?: string }).name === "AbortError" && timedOut) {
        throw new PayPayError({
          code: "REQUEST_TIMEOUT",
          message: `PayPay request to ${opts.method} ${opts.path} did not complete within ${timeoutMs}ms`,
          httpStatus: 0,
          raw: err,
        });
      }
      throw err;
    } finally {
      clearTimeout(timer);
      if (opts.signal) {
        opts.signal.removeEventListener("abort", forwardAbort);
      }
    }

    let parsed: unknown = undefined;
    if (text) {
      try {
        parsed = JSON.parse(text);
      } catch {
        throw new PayPayError({
          code: `NON_JSON_RESPONSE`,
          message: `PayPay returned non-JSON response (HTTP ${response.status}): ${text.slice(0, 200)}`,
          httpStatus: response.status,
          raw: text,
        });
      }
    }

    if (!response.ok) {
      throw parsePayPayError(response.status, parsed);
    }

    const envelope = parsed as PayPayResponse<T> | undefined;
    if (envelope?.resultInfo && envelope.resultInfo.code !== "SUCCESS") {
      throw parsePayPayError(response.status, envelope);
    }

    return envelope ?? ({ resultInfo: { code: "SUCCESS", message: "", codeId: "" } } as PayPayResponse<T>);
  }
}
