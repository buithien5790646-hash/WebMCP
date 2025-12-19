import { Logger, i18n, t } from "../modules/utils";
import { showConfirmationModal } from "../components/ConfirmModal";
import {
  markVisualProcessing,
  markVisualSuccess,
  markVisualError,
  writeToInputBox,
  triggerAutoSend,
  cancelAutoSend
} from "./ui";
import { detectPlatform } from "./adapters";
import { DOMObserver, MessageParser, Workflow } from "./core";
import { ToolExecutionPayload } from "../types";

let isClientConnected = false;
let userRules = "";
let protectedTools = new Set<string>();
const confirmationQueue: ToolExecutionPayload[] = [];
let isPopupOpen = false;

// Config state
interface ConfigState {
  pollInterval: number;
  autoSend: boolean;
  autoPromptEnabled: boolean;
}

let CONFIG: ConfigState = {
  pollInterval: 1000,
  autoSend: true,
  autoPromptEnabled: false,
};

// === Module Initialization ===
const workflow = new Workflow();
const parser = new MessageParser();
const adapter = detectPlatform();

// === Load I18n Resources ===
function loadResources() {
  const lang = i18n.lang;
  const promptKey = lang === "zh" ? "prompt_zh" : "prompt_en";
  const trainKey = lang === "zh" ? "train_zh" : "train_en";
  const errorKey = lang === "zh" ? "error_zh" : "error_en";

  chrome.storage.local.get([promptKey, trainKey, errorKey, "user_rules"], (items) => {
    i18n.resources.prompt = items[promptKey];
    i18n.resources.train = items[trainKey];
    i18n.resources.error = items[errorKey];
    userRules = items.user_rules || "";
    Logger.log(`[MCP] Loaded resources (${lang})`, "info");
  });
}

// === Message Handling ===
chrome.runtime.onMessage.addListener((request) => {
  if (request.type === "TOGGLE_LOG") {
    Logger.toggle(request.show);
  }
  if (request.type === "STATUS_UPDATE") {
    const wasConnected = isClientConnected;
    isClientConnected = request.connected;
    if (isClientConnected !== wasConnected) {
      Logger.log(`[MCP] Connection: ${isClientConnected ? "Connected" : "Disconnected"}`, "info");
      if (isClientConnected && observer) {
        observer.trigger();
      }
    }
  }
});

// === Storage Sync ===
chrome.storage.sync.get(
  ["autoSend", "autoPromptEnabled", "customSelectors", "protected_tools"],
  (items) => {
    CONFIG.autoSend = items.autoSend ?? true;
    CONFIG.autoPromptEnabled = items.autoPromptEnabled ?? false;
    if (items.protected_tools) protectedTools = new Set(items.protected_tools);
    // Note: customSelectors logic would be handled by adapters if we keep moving in that direction
  }
);

chrome.storage.onChanged.addListener((changes, namespace) => {
  if (namespace === "sync") {
    if (changes.autoSend) CONFIG.autoSend = changes.autoSend.newValue;
    if (changes.autoPromptEnabled) CONFIG.autoPromptEnabled = changes.autoPromptEnabled.newValue;
    if (changes.protected_tools) {
      protectedTools = new Set(changes.protected_tools.newValue);
    }
  }
});

// === Main Execution Loop ===
function runMainLoop() {
  if (!adapter || !isClientConnected) return;

  const messages = adapter.getMessageBlocks();
  if (messages.length === 0) {
    handleAutoPrompt();
    return;
  }

  const lastMessage = messages[messages.length - 1];
  const codeElements = adapter.getCodeBlocks(lastMessage);
  const currentTurnIds: string[] = [];

  codeElements.forEach((codeEl) => {
    const { payload, isStableError } = parser.parseCodeBlock(codeEl);

    if (payload && payload.request_id) {
      currentTurnIds.push(payload.request_id);

      if (!workflow.isProcessed(payload.request_id)) {
        workflow.markDiscovered(payload.request_id);
        cancelAutoSend();
        markVisualProcessing(codeEl as HTMLElement);
        Logger.log(`${t("captured")}: ${payload.name}`, "info");
        executeTool(payload);
      } else {
        if (workflow.isExecuting(payload.request_id)) {
          markVisualProcessing(codeEl as HTMLElement);
        } else {
          markVisualSuccess(codeEl as HTMLElement);
        }
      }
    } else if (isStableError) {
      markVisualError(codeEl as HTMLElement);
    }
  });

  // Batch Processing
  if (workflow.isBatchComplete(currentTurnIds)) {
    if (adapter.getStopButton()) {
      // AI is still generating
      return;
    }

    const results = workflow.flushBatch(currentTurnIds);
    if (results.length > 0) {
      Logger.log(`Batch finished: ${results.length} tools.`, "success");
      writeToInputBox(results.join("\n\n"), adapter.inputArea);
      triggerAutoSend(CONFIG, adapter);
    }
  }
}

function handleAutoPrompt() {
  const inputEl = adapter?.getInputElement();
  if (inputEl && CONFIG.autoPromptEnabled && (inputEl.textContent || "").trim() === "") {
    if (i18n.resources.prompt) {
      let finalPrompt = i18n.resources.prompt;
      if (userRules) finalPrompt += `\n\n=== User Rules ===\n${userRules}`;
      writeToInputBox(finalPrompt, adapter!.inputArea);
      Logger.log(t("auto_filled"), "action");
    }
  }
}

// === Tool Execution ===
function executeTool(payload: ToolExecutionPayload) {
  if (payload.name === "task_completion_notification") {
    finishVirtualTool(payload);
    return;
  }

  if (protectedTools.has(payload.name)) {
    Logger.log(`${t("hitl_intercept")}: ${payload.name}`, "warn");
    confirmationQueue.push(payload);
    processConfirmationQueue();
    return;
  }

  performExecution(payload);
}

function performExecution(payload: ToolExecutionPayload) {
  chrome.runtime.sendMessage({ type: "EXECUTE_TOOL", payload }, (response) => {
    workflow.markCompleted(payload.request_id);
    let outputContent = "";
    if (response && response.success) {
      Logger.log(`${t("exec_success")}: ${payload.name}`, "success");
      outputContent = response.data;

      // Handle tool list caching & projection if needed (list_tools special case)
      if (payload.name === "list_tools") {
        handleListToolsResponse(response.data);
      }
    } else {
      const errMsg = response?.error || "Unknown error";
      Logger.log(`${t("exec_fail")}: ${errMsg}`, "error");
      outputContent = `❌ Error: ${errMsg}`;
    }

    workflow.saveResult(payload.request_id, outputContent, !response?.success);
    setTimeout(runMainLoop, 50);
  });
}

function handleListToolsResponse(data: string) {
  try {
    const groups = JSON.parse(data);
    const toolNames: string[] = [];
    groups.forEach((g: any) => {
      if (g.tools) g.tools.forEach((t: any) => toolNames.push(t.name));
      if (g.hidden_tools) g.hidden_tools.forEach((n: string) => toolNames.push(n));
    });

    chrome.storage.local.get(["cached_tool_list"], (localData) => {
      const knownTools = new Set(localData.cached_tool_list || []);
      let protectedDirty = false;
      toolNames.forEach((tName) => {
        if (!knownTools.has(tName) && !protectedTools.has(tName)) {
          protectedTools.add(tName);
          protectedDirty = true;
        }
      });
      if (protectedDirty) {
        chrome.storage.sync.set({ protected_tools: Array.from(protectedTools) });
        Logger.log("🛡️ New tools detected & protected", "warn");
      }
      chrome.storage.local.set({ cached_tool_list: toolNames });
    });
  } catch (e) {
    console.error("List tools processing error", e);
  }
}

function finishVirtualTool(payload: ToolExecutionPayload) {
  const msg = (payload.arguments as any)?.message || "Task Completed";
  Logger.log(`🔔 Notification: ${msg}`, "action");
  chrome.runtime.sendMessage({
    type: "SHOW_NOTIFICATION",
    title: "WebMCP Task Finished",
    message: msg,
  });
  workflow.markCompleted(payload.request_id);
  workflow.saveResult(payload.request_id, "", false);
}

// === Confirmation Queue ===
function processConfirmationQueue() {
  if (isPopupOpen || confirmationQueue.length === 0) return;
  const payload = confirmationQueue[0];
  isPopupOpen = true;

  showConfirmationModal(
    payload,
    (isAlways) => {
      confirmationQueue.shift();
      isPopupOpen = false;
      if (adapter) {
        const inputEl = adapter.getInputElement();
        if (inputEl) inputEl.focus();
      }

      if (isAlways) {
        protectedTools.delete(payload.name);
        chrome.storage.sync.set({ protected_tools: Array.from(protectedTools) }, () => {
          chrome.runtime.sendMessage({ type: "SYNC_CONFIG" });
        });
        Logger.log(`⚡ Tool '${payload.name}' set to Always Allow`, "action");
      }

      performExecution(payload);
      processConfirmationQueue();
    },
    (reason) => {
      confirmationQueue.shift();
      isPopupOpen = false;
      workflow.markCompleted(payload.request_id);
      Logger.log(`${t("hitl_rejected")}: ${payload.name}`, "error");
      workflow.saveResult(
        payload.request_id,
        `User rejected execution. Reason: ${reason || "No reason provided."}`,
        true
      );
      processConfirmationQueue();
    }
  );
}

// === Initialization ===
const observer = new DOMObserver(runMainLoop, CONFIG.pollInterval);

if (adapter) {
  loadResources();
  observer.start();

  chrome.runtime.sendMessage({ type: "GET_STATUS" }, (response) => {
    isClientConnected = !!(response && response.connected);
    if (isClientConnected) {
      Logger.log(`WebMCP activated for ${adapter.name}`, "info");
      runMainLoop();
    }
  });
} else {
  console.log("WebMCP: Platform not supported.");
}
