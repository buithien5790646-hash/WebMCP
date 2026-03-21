import { Session, ToolExecutionPayload } from '@webmcp/shared';

// 为方便其他模块使用，重新导出共享库中的类型
export type { Session, ToolExecutionPayload };

// === 全局配置状态接口 ===
/**
 * 客户端运行时配置状态
 */
export interface ConfigState {
  pollInterval: number;       // DOM 轮询间隔 (毫秒)
  autoSend: boolean;          // 是否在写入数据后自动触发回车发送
  autoPromptEnabled: boolean; // 是否在空白会话中自动填入系统提示词
}

// === Storage 数据结构接口 ===
/**
 * 同步存储 (Sync Storage) 数据结构
 * 随用户的 Chrome 账号在不同设备间同步
 */
export interface SyncStorage {
  autoSend?: boolean;
  autoPromptEnabled?: boolean;
  user_rules?: string;                 // 用户自定义规则，附加在主系统提示词末尾
  customSelectors?: Record<string, any>; // 用户自定义的网站 DOM 选择器覆盖配置
}

/**
 * 本地存储 (Local Storage) 数据结构
 * 仅保存在当前浏览器实例中
 */
export interface LocalStorage {
  defaultSelectors?: Record<string, any>;   // 从 VS Code 网关拉取的默认 DOM 选择器
  [key: `allowed_tools_${string}`]: string[]; // 各工作区对应的免审工具名称白名单
  [key: `prompt_${string}`]: string;        // 英文主提示词
  [key: `train_${string}`]: string;         // 英文复训提示词
  [key: `error_${string}`]: string;         // 英文错误处理提示词
  [key: `init_${string}`]: string;          // 英文初始化加载提示
  [key: `session_${string}`]: Session;      // 特定标签页 ID 绑定的 WebMCP 会话数据
}

// === 消息通信协议 (Message Protocol) ===
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

/**
 * 扩展内部跨脚本通信的消息载荷类型定义
 */
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

/** 握手响应结果 */
export interface HandshakeResponse {
  success: boolean;
  error?: string;
  conflictTabId?: string; // 若发生冲突，返回冲突的旧标签页 ID
}

/** 工具执行响应结果 */
export interface ExecuteToolResponse {
  success: boolean;
  data?: any;
  error?: string;
}

/** 连接状态响应结果 */
export interface StatusResponse {
  connected: boolean;
  port?: number;
  showLog?: boolean;
  workspaceId?: string;
  error?: string;
}
