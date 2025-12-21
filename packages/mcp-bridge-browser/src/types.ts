import { z } from "zod";
import { SessionSchema, ToolExecutionSchema, MessageRequestSchema } from "./types/schemas";

// === Shared Types ===

export type Session = z.infer<typeof SessionSchema>;

export type ToolExecutionPayload = z.infer<typeof ToolExecutionSchema> & {
  request_id: string; // Mandatory for workflow tracking
  mcp_action?: "call";
  purpose?: string;
};

// === Extension-Internal Types ===

export type MessageRequest = z.infer<typeof MessageRequestSchema>;

export interface HandshakeResponse {
  success: boolean;
  error?: string;
  conflictTabId?: string;
}
