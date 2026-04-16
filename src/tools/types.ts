/**
 * Shared types for the MCP tool registry.
 *
 * Each tool ships bilingual JP/EN descriptions so LLM clients can reason about
 * them natively in either language — a first-class Japanese experience is one
 * of this MCP's core differentiators.
 */

import type { z } from "zod";
import type { PayPayClient } from "../client.js";

// A tool's input schema is always a ZodObject so the MCP SDK can introspect
// its `.shape` for JSON-Schema generation.
export type ToolInputSchema = z.ZodObject<z.ZodRawShape>;

export interface ToolDefinition<TInput extends ToolInputSchema = ToolInputSchema> {
  name: string;
  title: string;
  /** English-first description with a trailing Japanese translation. */
  description: string;
  /** Input schema validated with Zod before reaching the handler. */
  inputSchema: TInput;
  handler: (input: z.infer<TInput>, client: PayPayClient) => Promise<ToolResult>;
}

export type ToolResult =
  | { type: "text"; text: string }
  | { type: "text-and-image"; text: string; imagePng: Buffer; mimeType: "image/png" };

export function textResult(text: string): ToolResult {
  return { type: "text", text };
}

export function imageResult(text: string, imagePng: Buffer): ToolResult {
  return { type: "text-and-image", text, imagePng, mimeType: "image/png" };
}
