import { Session, ToolExecutionPayload } from '@webmcp/shared';

// Re-export shared types for convenience
export type { Session, ToolExecutionPayload };

// === Config State ===
export interface ConfigState {
  pollInterval: number;
  autoSend: boolean;
  autoPromptEnabled: boolean;
}

// === Storage Types ===
export interface SyncStorage {
  autoSend?: boolean;
  autoPromptEnabled?: boolean;
  user_rules?: string;
  customSelectors?: Record<string, any>;
}

export interface LocalStorage {
  defaultSelectors?: Record<string, any>;
  [key: `allowed_tools_${string}`]: string[];
  [key: `prompt_${string}`]: string;
  [key: `train_${string}`]: string;
  [key: `error_${string}`]: string;
  [key: `init_${string}`]: string;
  [key: `session_${string}`]: Session;
}

// === Message Protocol ===
export interface MessageRequest {
  type: string;
  tabId?: number;
  port?: number;
  token?: string;
  workspaceId?: string;
  force?: boolean;
  show?: boolean;
  title?: string;
  message?: string;
  payload?: ToolExecutionPayload;
}

export type ExtensionMessage =
  | { type: 'HANDSHAKE'; port: number; token: string; workspaceId: string; force?: boolean }
  | { type: 'EXECUTE_TOOL'; payload: ToolExecutionPayload }
  | { type: 'GET_STATUS'; tabId?: number }
  | { type: 'STATUS_UPDATE'; connected: boolean; workspaceId?: string }
  | { type: 'TOGGLE_LOG'; show: boolean }
  | { type: 'SHOW_NOTIFICATION'; title: string; message: string }
  | { type: 'SET_LOG_VISIBLE'; tabId: number; show: boolean }
  | { type: 'CONNECT_EXISTING'; port: number; token: string; tabId: number; workspaceId?: string }
  | { type: 'SYNC_CONFIG' };

export interface HandshakeResponse {
  success: boolean;
  error?: string;
  conflictTabId?: string;
}

export interface ExecuteToolResponse {
  success: boolean;
  data?: any;
  error?: string;
}

export interface StatusResponse {
  connected: boolean;
  port?: number;
  showLog?: boolean;
  workspaceId?: string;
  error?: string;
}
