import { i18n, logger as Logger, messageBroker, getLocal, getSync, onStorageChanged } from "@/services";
import {
  writeToInputBox,
  ModalManager
} from "./ui";
import { detectPlatform } from "./adapters";
import { DOMObserver, MessageParser, Workflow, ExecutionEngine } from "./core";

let isClientConnected = false;
let userRules = "";
let protectedTools = new Set<string>();

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

// Declare observer at top level so message handlers can see it
let observer: DOMObserver | undefined;
let engine: ExecutionEngine | undefined;

// === Load I18n Resources ===
function loadResources() {
  const lang = i18n.lang;
  const promptKey = (lang === "zh" ? "prompt_zh" : "prompt_en") as any;
  const trainKey = (lang === "zh" ? "train_zh" : "train_en") as any;
  const errorKey = (lang === "zh" ? "error_zh" : "error_en") as any;

  getLocal([promptKey, trainKey, errorKey, "user_rules"]).then((items) => {
    i18n.resources.prompt = (items as any)[promptKey];
    i18n.resources.train = (items as any)[trainKey];
    i18n.resources.error = (items as any)[errorKey];
    userRules = items.user_rules || "";
    Logger.log(`[MCP] Loaded resources (${lang})`, "info");
  });
}

// === Message Handling ===
messageBroker.on("TOGGLE_LOG", (request) => {
  Logger.toggle(request.show);
});

messageBroker.on("STATUS_UPDATE", (request) => {
  const wasConnected = isClientConnected;
  isClientConnected = request.connected;
  if (isClientConnected !== wasConnected) {
    Logger.log(`[MCP] Connection: ${isClientConnected ? "Connected" : "Disconnected"}`, "info");
    if (isClientConnected && observer) {
      observer.trigger();
    }
  }
});

// === Storage Sync ===
getSync(["autoSend", "autoPromptEnabled", "protected_tools"] as any).then((items) => {
  CONFIG.autoSend = items.autoSend ?? true;
  CONFIG.autoPromptEnabled = items.autoPromptEnabled ?? false;
  if (items.protected_tools) protectedTools = new Set(items.protected_tools);
});

onStorageChanged((changes, namespace) => {
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
  if (!adapter || !isClientConnected || !engine) return;

  const messages = adapter.getMessageBlocks();
  if (messages.length === 0) {
    handleAutoPrompt();
    return;
  }

  const lastMessage = messages[messages.length - 1];
  const codeElements = adapter.getCodeBlocks(lastMessage);
  const currentTurnIds: string[] = [];

  // Pass currentTurnIds for batch tracking
  Array.from(codeElements).forEach((codeEl) => {
    const { payload } = parser.parseCodeBlock(codeEl);
    if (payload && payload.request_id) {
      currentTurnIds.push(payload.request_id);
    }
  });

  // Delegate processing to engine
  engine.updateConfig({
    autoSend: CONFIG.autoSend,
    protectedTools: protectedTools
  });

  engine.processCodeBlocks(Array.from(codeElements));

  // Flush Results via Engine
  engine.flushResults(currentTurnIds);
}

function handleAutoPrompt() {
  const inputEl = adapter?.getInputElement();
  if (inputEl && CONFIG.autoPromptEnabled && (inputEl.textContent || "").trim() === "") {
    if (i18n.resources.prompt) {
      let finalPrompt = i18n.resources.prompt;
      if (userRules) finalPrompt += `\n\n=== User Rules ===\n${userRules}`;
      writeToInputBox(finalPrompt, adapter!.inputArea);
      Logger.log(i18n.lang === "zh" ? "已自动填充提示词" : "Auto-filled prompt", "action");
    }
  }
}

// === Initialization ===
if (adapter) {
  loadResources();
  const modalManager = new ModalManager();
  observer = new DOMObserver(runMainLoop, CONFIG.pollInterval);
  engine = new ExecutionEngine(parser, workflow, adapter, modalManager);

  observer.start();

  messageBroker.send({ type: "GET_STATUS" }).then((response) => {
    isClientConnected = !!(response && response.connected);
    if (isClientConnected) {
      Logger.log(`WebMCP activated for ${adapter.name}`, "info");
      runMainLoop();
    }
  });
} else {
  console.log("WebMCP: Platform not supported.");
}
