/**
 * PayPay OPA HMAC authentication.
 *
 * Authorization header format:
 *   hmac OPA-Auth:<clientId>:<macData>:<nonce>:<epoch>:<payloadDigest>
 *
 * Where:
 *   macData         = base64(HMAC-SHA256(clientSecret, signData))
 *   signData        = [resourceUrl, method, nonce, epoch, contentType, payloadDigest].join("\n")
 *   payloadDigest   = "empty" when no body,
 *                     else base64(md5(contentType + jsonified_body))
 *   contentType     = "empty" when no body, else "application/json"
 *   epoch           = Math.floor(Date.now() / 1000)
 *   nonce           = UUID v4 (the official SDK uses uuid v4; any unique string works)
 *
 * Verified against paypayopa/paypayopa-sdk-node dist/lib/paypay-rest-sdk.js.
 */

import { createHash, createHmac, randomUUID } from "node:crypto";

export interface SignArgs {
  apiKey: string;
  apiSecret: string;
  method: string;
  /** Path + query string, no host. e.g. "/v2/codes" */
  resourceUrl: string;
  /** Stringified JSON body, or undefined for GET/DELETE with no body. */
  body: string | undefined;
}

export interface SignedHeaders {
  Authorization: string;
  "Content-Type"?: string;
}

const JSON_CONTENT_TYPE = "application/json";

export function sign(args: SignArgs): SignedHeaders {
  const epoch = Math.floor(Date.now() / 1000).toString();
  const nonce = randomUUID();

  let contentType: string;
  let payloadDigest: string;

  const hasBody = args.body !== undefined && args.body !== "" && args.body !== "undefined" && args.body !== "null";
  if (!hasBody) {
    contentType = "empty";
    payloadDigest = "empty";
  } else {
    contentType = JSON_CONTENT_TYPE;
    payloadDigest = createHash("md5")
      .update(contentType)
      .update(args.body!)
      .digest("base64");
  }

  const signData = [
    args.resourceUrl,
    args.method.toUpperCase(),
    nonce,
    epoch,
    contentType,
    payloadDigest,
  ].join("\n");

  const macData = createHmac("sha256", args.apiSecret)
    .update(signData)
    .digest("base64");

  const authorization =
    `hmac OPA-Auth:${args.apiKey}:${macData}:${nonce}:${epoch}:${payloadDigest}`;

  const headers: SignedHeaders = { Authorization: authorization };
  if (hasBody) headers["Content-Type"] = JSON_CONTENT_TYPE;
  return headers;
}
