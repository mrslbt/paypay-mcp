/**
 * Shared types for the MCP tool registry.
 *
 * Each tool ships bilingual JP/EN descriptions so LLM clients can reason about
 * them natively in either language — a first-class Japanese experience is one
 * of this MCP's core differentiators.
 */

import type { ToolAnnotations } from "@modelcontextprotocol/sdk/types.js";
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
  /**
   * Behavioral hints surfaced to MCP clients (per the MCP spec) so they can
   * warn the user before money-moving or destructive calls. Required on every
   * tool so a payment server can never silently ship a tool without declaring
   * its safety profile. Note: all fields are advisory hints, not enforcement.
   */
  annotations: ToolAnnotations;
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
