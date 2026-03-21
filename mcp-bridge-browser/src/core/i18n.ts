// === 统一的日志与翻译字典 ===
/**
 * 界面和日志多语言文本字典，支持中英双语
 */
const LOG_MSGS: Record<string, { en: string; zh: string }> = {
  // 通用日志和界面提示
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
  send_btn_disabled: { en: "Send button disabled (UI not updated)...", zh: "发送按钮仍被禁用 (UI未更新)..." },
  auto_send_attempt: { en: "Attempting auto-send", zh: "尝试自动发送" },
  auto_send_timeout: { en: "Auto-send timed out, please click manually", zh: "自动发送超时，请手动点击发送" },
  config_updated: { en: "Selectors config updated", zh: "选择器配置已更新" },
  waiting_tools: { en: "Waiting for tools...", zh: "等待工具执行..." },
  hitl_intercept: { en: "Intercepted for approval", zh: "拦截等待审批" },
  hitl_rejected: { en: "User rejected execution", zh: "用户拒绝执行" },

  // HITL (Human-in-the-Loop) 人工审批弹窗 UI
  hitl_title: { en: "Approval Required", zh: "请求执行工具" },
  label_tool: { en: "Tool Name", zh: "工具名称" },
  label_purpose: { en: "Purpose", zh: "操作意图" },
  label_args: { en: "Arguments", zh: "调用参数" },
  placeholder_reason: { en: "Reason for rejection (Optional)...", zh: "拒绝理由 (可选)..." },

  // 按钮文本
  btn_always: { en: "⚡ Always Allow", zh: "⚡ 永久允许" },
  btn_back: { en: "Back", zh: "返回" },
  btn_reject: { en: "Reject", zh: "拒绝" },
  btn_reject_confirm: { en: "Confirm Rejection", zh: "确认拒绝" },
  btn_approve: { en: "Approve", zh: "允许" },
  btn_allow_confirm: { en: "Confirm Allow", zh: "确认永久允许" },

  // 永久允许弹窗文案
  always_title: { en: "Remove Protection?", zh: "移除保护？" },
  always_desc_1: { en: "You are about to permanently allow", zh: "您即将把以下工具移出保护名单：" },
  always_desc_2: { en: "Future calls will execute automatically without approval.", zh: "今后 AI 调用此工具将不再经过人工审批。" }
};

/**
 * 国际化 (i18n) 服务类
 * 用于处理界面和日志的多语言显示，以及管理内置的预设 Prompt 资源
 */
class I18nService {
  private currentLang: 'en' | 'zh' = 'en';
  /**
   * 存储各类提示词资源（如主系统提示词、复训提示词、错误处理提示词等）
   */
  private prompts: { prompt: string | null; train: string | null; error: string | null; init: string | null } = {
    prompt: null, train: null, error: null, init: null
  };

  constructor() {
    // 根据浏览器的首选语言自动设置界面语言
    this.currentLang = navigator.language.startsWith('zh') ? 'zh' : 'en';
  }

  /** 获取当前语言 */
  get lang() {
    return this.currentLang;
  }

  /** 获取当前加载的系统提示词资源 */
  get resources() {
    return this.prompts;
  }

  /**
   * 更新或设置系统提示词资源
   * @param resources 要合并更新的提示词对象
   */
  setResources(resources: Partial<typeof this.prompts>) {
    this.prompts = { ...this.prompts, ...resources };
  }

  /**
   * 翻译指定的键名
   * @param key 字典中的键名
   * @returns 翻译后的文本内容，如果未找到则返回键名本身
   */
  t(key: string): string {
    const entry = LOG_MSGS[key];
    if (!entry) { return key; }
    return entry[this.currentLang] || entry.en;
  }
}

// 导出全局单例实例和快捷翻译函数
export const i18n = new I18nService();
export const t = (key: string) => i18n.t(key);
