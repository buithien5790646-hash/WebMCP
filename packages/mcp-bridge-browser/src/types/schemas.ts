import { z } from 'zod';

/**
 * Session Schema
 */
export const SessionSchema = z.object({
    port: z.number(),
    token: z.string(),
    workspaceId: z.string().optional(),
    showLog: z.boolean().default(false),
});

/**
 * Message Request Schema (Base)
 */
export const MessageRequestSchema = z.object({
    type: z.string(),
    payload: z.any().optional(),
    tabId: z.number().optional(),
    port: z.number().optional(),
    token: z.string().optional(),
    force: z.boolean().optional(),
    show: z.boolean().optional(),
    title: z.string().optional(),
    message: z.string().optional(),
});

/**
 * Tool Execution Payload Schema
 */
export const ToolExecutionSchema = z.object({
    name: z.string(),
    arguments: z.record(z.any()).default({}),
});

/**
 * Gateway Configuration Schema
 */
export const GatewayConfigSchema = z.object({
    version: z.number(),
    timestamp: z.string(),
    sync: z.record(z.any()),
    local: z.record(z.string()),
});

export type SessionData = z.infer<typeof SessionSchema>;
export type MessageRequestData = z.infer<typeof MessageRequestSchema>;
export type ToolExecutionData = z.infer<typeof ToolExecutionSchema>;
export type GatewayConfigData = z.infer<typeof GatewayConfigSchema>;
