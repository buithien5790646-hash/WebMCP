import { Session } from '../types';

const els = {
  selectors: document.getElementById("selectorsJson") as HTMLTextAreaElement,
  defaultSelectors: document.getElementById("defaultSelectorsJson") as HTMLTextAreaElement,
  userRules: document.getElementById("userRules") as HTMLTextAreaElement,
  status: document.getElementById("status") as HTMLElement,
  currentLang: document.getElementById("currentLang") as HTMLElement,
  // UI Text Elements for i18n
  title: document.getElementById("title") as HTMLElement,
  sec_selectors: document.getElementById("sec_selectors") as HTMLElement,
  desc_selectors: document.getElementById("desc_selectors") as HTMLElement,
  sec_prompts: document.getElementById("sec_prompts") as HTMLElement,
  lbl_user_rules: document.getElementById("lbl_user_rules") as HTMLElement,
  desc_user_rules: document.getElementById("desc_user_rules") as HTMLElement,
  save: document.getElementById("save") as HTMLButtonElement,
  reset: document.getElementById("reset") as HTMLButtonElement,
};

// Determine language context
const lang = navigator.language.startsWith("zh") ? "zh" : "en";

// UI Strings
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

function t(key: string): string {
  return UI[lang][key] || UI.en[key];
}

// Apply UI Text
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

function showStatus(msg: string, type = "success") {
  els.status.textContent = msg;
  els.status.className = type === "success" ? "status-success" : "status-error";
  setTimeout(() => {
    els.status.textContent = "";
    els.status.className = "";
  }, 3000);
}

async function restoreOptions() {
  // Load defaults from local storage (synced from VS Code)
  chrome.storage.local.get(["defaultSelectors"], (localItems) => {
    const defaults = localItems.defaultSelectors;
    if (defaults) {
      els.defaultSelectors.value = JSON.stringify(defaults, null, 2);
    } else {
      els.defaultSelectors.value = "No defaults received yet. Connect to VS Code first.";
    }
  });

  // Load user overrides from sync storage
  chrome.storage.sync.get(["customSelectors", "user_rules"], (items) => {
    const config = items.customSelectors || {};
    els.selectors.value = Object.keys(config).length > 0 ? JSON.stringify(config, null, 2) : "{\n  \n}";
    els.userRules.value = items.user_rules || "";
  });
}

function saveOptions() {
  const jsonString = els.selectors.value.trim();
  let config = {};
  if (jsonString && jsonString !== "{}" && jsonString !== "{\n  \n}") {
    try {
      config = JSON.parse(jsonString);
    } catch (e: any) {
      showStatus(t("error_json") + " " + e.message, "error");
      return;
    }
  }

  chrome.storage.sync.set({
    customSelectors: config,
    user_rules: els.userRules.value
  }, () => {
    showStatus(t("saved"), "success");
  });
}

async function resetOptions() {
  if (confirm(t("reset_confirm"))) {
    els.selectors.value = "{\n  \n}";
    els.userRules.value = "";
    saveOptions();
    showStatus(t("restored"));
  }
}

document.addEventListener("DOMContentLoaded", () => {
  initUI();
  restoreOptions();
});
els.save.addEventListener("click", saveOptions);
els.reset.addEventListener("click", resetOptions);
