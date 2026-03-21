// 获取各个 UI 元素的 DOM 引用
const els = {
  selectors: document.getElementById("selectorsJson") as HTMLTextAreaElement,
  defaultSelectors: document.getElementById("defaultSelectorsJson") as HTMLTextAreaElement,
  userRules: document.getElementById("userRules") as HTMLTextAreaElement,
  status: document.getElementById("status") as HTMLElement,
  currentLang: document.getElementById("currentLang") as HTMLElement,
  // 需要进行多语言翻译的 UI 文本元素
  title: document.getElementById("title") as HTMLElement,
  sec_selectors: document.getElementById("sec_selectors") as HTMLElement,
  desc_selectors: document.getElementById("desc_selectors") as HTMLElement,
  sec_prompts: document.getElementById("sec_prompts") as HTMLElement,
  lbl_user_rules: document.getElementById("lbl_user_rules") as HTMLElement,
  desc_user_rules: document.getElementById("desc_user_rules") as HTMLElement,
  save: document.getElementById("save") as HTMLButtonElement,
  reset: document.getElementById("reset") as HTMLButtonElement,
};

// 确定当前的语言上下文（中/英）
const lang = navigator.language.startsWith("zh") ? "zh" : "en";

// UI 多语言字符串字典
const UI: Record<string, Record<string, string>> = {
  en: {
    title: "WebMCP Settings",
    sec_selectors: "Site Selectors Override",
    desc_selectors:
      "Customize DOM selectors if the default ones from VS Code fail. Leave empty to use defaults. Note: You only need to provide the fields you want to override.",
    sec_prompts: "User Rules",
    lbl_user_rules: "Custom Preferences & Instructions",
    desc_user_rules:
      "Your personal requirements (e.g., 'Always ask before coding'). These instructions will be appended to the AI's system prompt in all connected workspaces.",
    save: "Save Settings",
    reset: "Clear Config",
    saved: "Settings saved successfully!",
    reset_confirm:
      "Are you sure you want to clear your selector overrides and rules?",
    error_json: "Error: Invalid JSON format in Selectors.",
    restored: "Config cleared.",
  },
  zh: {
    title: "WebMCP 设置",
    sec_selectors: "站点选择器 (覆盖规则)",
    desc_selectors: "当 VS Code 下发的默认选择器失效时，可在此自定义覆盖规则。保持为空则使用默认配置。",
    sec_prompts: "用户自定义规则",
    lbl_user_rules: "个性化指令与偏好",
    desc_user_rules: "你的个性化要求（如“写代码前先确认方案”）。该指令会自动追加到所有工作区的 AI 系统提示词中。",
    save: "保存设置",
    reset: "清空配置",
    saved: "设置已成功保存！",
    reset_confirm: "确定要清空自定义的选择器覆盖规则和用户提示词吗？",
    error_json: "错误：选择器配置 JSON 格式无效。",
    restored: "已清空配置。",
  },
};

/**
 * 翻译指定的 UI 文本键名
 */
function t(key: string): string {
  return UI[lang][key] || UI.en[key];
}

/**
 * 将多语言文本应用到 DOM 元素上
 */
function initUI() {
  els.currentLang.textContent = lang.toUpperCase();
  els.title.textContent = t("title");
  els.sec_selectors.textContent = t("sec_selectors");
  els.desc_selectors.textContent = t("desc_selectors");
  els.sec_prompts.textContent = t("sec_prompts");
  els.lbl_user_rules.textContent = t("lbl_user_rules");
  els.desc_user_rules.textContent = t("desc_user_rules");
  els.save.textContent = t("save");
  els.reset.textContent = t("reset");
}

/**
 * 在页面底部显示状态提示信息（支持自动消失）
 * @param msg 提示内容
 * @param type 提示类型 (success/error)
 */
function showStatus(msg: string, type = "success") {
  els.status.textContent = msg;
  els.status.className = type === "success" ? "status-success" : "status-error";
  setTimeout(() => {
    els.status.textContent = "";
    els.status.className = "";
  }, 3000);
}

/**
 * 从 Storage 恢复并显示保存的配置项
 */
async function restoreOptions() {
  // 从 Local Storage 加载由 VS Code 网关同步的默认选择器，并只读展示
  const localItems = await chrome.storage.local.get(["defaultSelectors"]);
  const defaults = localItems.defaultSelectors;
  if (defaults) {
    els.defaultSelectors.value = JSON.stringify(defaults, null, 2);
  } else {
    els.defaultSelectors.value = "No defaults received yet. Connect to VS Code first.";
  }

  // 从 Sync Storage 加载用户自定义的配置数据
  const syncItems = await chrome.storage.sync.get(["customSelectors", "user_rules"]);
  const config = syncItems.customSelectors || {};
  // 如果没有配置，显示一个空的 JSON 对象结构作为模板
  els.selectors.value = Object.keys(config).length > 0 ? JSON.stringify(config, null, 2) : "{\n  \n}";
  els.userRules.value = syncItems.user_rules || "";
}

/**
 * 保存用户的自定义配置到 Sync Storage
 */
async function saveOptions() {
  const jsonString = els.selectors.value.trim();
  let config = {};
  // 仅在用户输入了有效的 JSON 时进行解析和保存
  if (jsonString && jsonString !== "{}" && jsonString !== "{\n  \n}") {
    try {
      config = JSON.parse(jsonString);
    } catch (e: any) {
      // 捕获 JSON 格式错误并提示
      showStatus(t("error_json") + " " + e.message, "error");
      return;
    }
  }

  // 写入存储
  await chrome.storage.sync.set({
    customSelectors: config,
    user_rules: els.userRules.value
  });
  showStatus(t("saved"), "success");
}

/**
 * 清空用户的自定义配置恢复到出厂默认状态
 */
async function resetOptions() {
  // 需要用户二次确认以防止误操作
  if (confirm(t("reset_confirm"))) {
    els.selectors.value = "{\n  \n}";
    els.userRules.value = "";
    await saveOptions();
    showStatus(t("restored"));
  }
}

// 页面加载完成后初始化 UI 和数据
document.addEventListener("DOMContentLoaded", () => {
  initUI();
  restoreOptions();
});
els.save.addEventListener("click", saveOptions);
els.reset.addEventListener("click", resetOptions);
