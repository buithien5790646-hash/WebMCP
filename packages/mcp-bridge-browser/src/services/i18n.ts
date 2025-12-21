/**
 * Internationalization Service
 * Manages language detection and translation resources
 */

export interface I18nResources {
  prompt: string | null;
  train: string | null;
  error: string | null;
}

export type Language = "en" | "zh";

class I18nService {
  private _lang: Language;
  private _resources: I18nResources = {
    prompt: null,
    train: null,
    error: null,
  };

  constructor() {
    this._lang = navigator.language.startsWith("zh") ? "zh" : "en";
    this.t = this.t.bind(this);
  }

  get lang(): Language {
    return this._lang;
  }

  get resources(): I18nResources {
    return this._resources;
  }

  setResources(resources: Partial<I18nResources>) {
    this._resources = { ...this._resources, ...resources };
  }

  /**
   * Get translated text by key
   */
  t(key: string): string {
    const translations: Record<string, { en: string; zh: string }> = {
      auto_filled: { en: "Auto-filled initial Prompt", zh: "已自动填充初始 Prompt" },
      captured: { en: "Captured Call", zh: "捕获调用" },
      args: { en: "Args", zh: "参数" },
      exec_success: { en: "Execution Success", zh: "执行成功" },
      exec_fail: { en: "Execution Failed", zh: "执行失败" },
      training_hint: { en: "Added periodic training note", zh: "已附加定期复训提示" },
      input_not_found: { en: "Input box not found!", zh: "找不到输入框!" },
      result_written: { en: "Result written back to input", zh: "结果已回填至输入框" },
      send_success_cleared: { en: "Send success (Input cleared)", zh: "发送成功 (输入框已清空)" },
      send_btn_missing: { en: "Send button not found...", zh: "未找到发送按钮..." },
      send_btn_disabled: {
        en: "Send button disabled (UI not updated)...",
        zh: "发送按钮仍被禁用 (UI未更新)...",
      },
      auto_send_attempt: { en: "Attempting auto-send", zh: "尝试自动发送" },
      auto_send_timeout: {
        en: "Auto-send timed out, please click manually",
        zh: "自动发送超时,请手动点击发送",
      },
      config_updated: { en: "Selectors config updated", zh: "选择器配置已更新" },
      waiting_tools: { en: "Waiting for tools...", zh: "等待工具执行..." },
      hitl_intercept: { en: "Intercepted for approval", zh: "拦截等待审批" },
      hitl_rejected: { en: "User rejected execution", zh: "用户拒绝执行" },
      hitl_title: { en: "Approval Required", zh: "请求执行工具" },
      label_tool: { en: "Tool Name", zh: "工具名称" },
      label_purpose: { en: "Purpose", zh: "操作意图" },
      label_args: { en: "Arguments", zh: "调用参数" },
      placeholder_reason: { en: "Reason for rejection (Optional)...", zh: "拒绝理由 (可选)..." },
      btn_always: { en: "⚡ Always Allow", zh: "⚡ 永久允许" },
      btn_back: { en: "Back", zh: "返回" },
      btn_reject: { en: "Reject", zh: "拒绝" },
      btn_reject_confirm: { en: "Confirm Rejection", zh: "确认拒绝" },
      btn_approve: { en: "Approve", zh: "允许" },
      btn_allow_confirm: { en: "Confirm Allow", zh: "确认永久允许" },
      always_title: { en: "Remove Protection?", zh: "移除保护?" },
      always_desc_1: {
        en: "You are about to permanently allow",
        zh: "您即将把以下工具移出保护名单:",
      },
      always_desc_2: {
        en: "Future calls will execute automatically without approval.",
        zh: "今后 AI 调用此工具将不再经过人工审批。",
      },
      popup_title: { en: "WebMCP Bridge", zh: "WebMCP Bridge" },
      popup_connected: { en: "✅ Connected to VS Code", zh: "✅ 已连接至 VS Code" },
      popup_port: { en: "Port", zh: "端口" },
      btn_copy_prompt: { en: "Copy System Prompt", zh: "复制 System Prompt" },
      btn_copied: { en: "✅ Copied!", zh: "✅ 已复制!" },
      btn_settings: { en: "Open Settings", zh: "打开设置" },
      popup_auto_send: { en: "Auto Send Message", zh: "自动发送消息" },
      popup_show_log: { en: "Show Floating Log", zh: "显示悬浮日志" },
      popup_gateways: { en: "Available Gateways", zh: "可用网关" },
      btn_connect_to: { en: "Connect to", zh: "连接至" },
      popup_status_disconnected: { en: "🔴 Disconnected", zh: "🔴 未连接" },
      popup_status_instructions: { en: "💡 Instructions", zh: "💡 使用说明" },
      instr_how_to_start: { en: "Already Installed?", zh: "如何启动？" },
      instr_step_1: {
        en: "Click WebMCP in VS Code Status Bar (bottom right) and follow the steps to launch.",
        zh: "点击 VS Code 状态栏（右下角）的 WebMCP 并按照步骤启动。",
      },
      instr_not_installed: { en: "Not Installed?", zh: "尚未安装？" },
      instr_search_marketplace: {
        en: "Search in VS Code Marketplace:",
        zh: "在 VS Code 插件市场搜索：",
      },

      // Options Page
      opt_title: { en: "WebMCP Settings", zh: "WebMCP 设置" },
      tab_workspace: { en: "Workspace Settings", zh: "当前工作区设置" },
      tab_global: { en: "Global Settings", zh: "全局设置" },
      opt_hitl_title: { en: "Human-in-the-Loop (Approval)", zh: "人工审批 (HITL)" },
      opt_hitl_desc: {
        en: "Select tools that require manual approval before execution.",
        zh: "选择在执行前需要人工确认的工具。",
      },
      btn_refresh_list: { en: "🔄 Refresh List", zh: "🔄 刷新列表" },
      opt_no_tools: {
        en: "No tools detected yet. Please use the extension once.",
        zh: "尚未检测到任何工具。请先在 AI 页面使用一次本插件。",
      },
      opt_prompts_title: { en: "System Prompts", zh: "系统提示词 (Prompts)" },
      opt_init_label: { en: "Initial System Prompt", zh: "初始系统提示词 (Initial)" },
      opt_init_desc: {
        en: "Sent to AI when you start a new conversation. (Supports Markdown)",
        zh: "开启新对话时发送给 AI。支持 Markdown。",
      },
      opt_rules_label: { en: "User Rules (Custom Preferences)", zh: "个人规则 (自定义偏好)" },
      opt_rules_desc: {
        en: 'Your personal requirements (e.g., "Always ask before coding"). Appended to System & Training prompts.',
        zh: "你的个性化要求（如“写代码前先询问”）。会追加到系统和训练提示词中。",
      },
      opt_train_label: { en: "Training Hint (Periodic)", zh: "训练补丁 (周期性)" },
      opt_train_desc: {
        en: "Inserted periodically (every 5 tool calls) to remind AI of the protocol.",
        zh: "每隔 5 次工具调用插入一次，提醒 AI 遵守协议。",
      },
      opt_error_label: { en: "Format Error Hint", zh: "格式报错提示 (Error)" },
      opt_error_desc: {
        en: "Sent to AI when it generates invalid JSON or fails to follow protocol.",
        zh: "当 AI 返回无效 JSON 或未遵守协议时发送。",
      },
      btn_reset: { en: "Reset to Defaults", zh: "恢复默认设置" },
      btn_save: { en: "Save Settings", zh: "保存设置" },
      status_saved_synced: {
        en: "Settings saved & synced to VS Code!",
        zh: "设置已保存并同步至 VS Code！",
      },
      status_saved_local: {
        en: "Saved locally (VS Code disconnected).",
        zh: "已保存至本地（VS Code 未连接）。",
      },
      status_reset_done: { en: "Restored defaults from files.", zh: "已从文件恢复默认设置。" },
      status_tools_updated: { en: "Tool list updated!", zh: "工具列表已更新！" },
      status_gateway_failed: { en: "Failed to connect to Gateway.", zh: "无法连接至网关。" },
      confirm_reset: {
        en: "Are you sure you want to reset ALL settings to defaults?",
        zh: "确定要将所有设置恢复为默认值吗？",
      },
    };

    const entry = translations[key];
    if (!entry) return key;
    return entry[this._lang] || entry.en;
  }
}

export const i18n = new I18nService();
