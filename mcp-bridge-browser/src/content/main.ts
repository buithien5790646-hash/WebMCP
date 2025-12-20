import { i18n, logger as Logger, messageBroker, getLocal, getSync, onStorageChanged } from "@/services";
import {
  ModalManager
} from "./ui";
import { detectPlatform } from "./adapters";
import { DOMObserver, MessageParser, Workflow, ExecutionEngine } from "./core";

let isClientConnected = false;
let protectedTools = new Set<string>();

// Config state
interface ConfigState {
  pollInterval: number;
  autoSend: boolean;
}

let CONFIG: ConfigState = {
  pollInterval: 1000,
  autoSend: true,
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

  if (request.config) {
    const config = request.config;
    i18n.resources.prompt = config.prompt;
    i18n.resources.train = config.train;
    i18n.resources.error = config.error_hint;
    if (config.protected_tools) {
      protectedTools = new Set(config.protected_tools);
    }
    Logger.log("[MCP] Workspace config applied", "info");
  }

  if (isClientConnected !== wasConnected) {
    Logger.log(`[MCP] Connection: ${isClientConnected ? "Connected" : "Disconnected"}`, "info");
    if (isClientConnected && observer) {
      observer.trigger();
    }
  }
});

// === Storage Sync ===
getSync(["autoSend", "protected_tools"] as any).then((items) => {
  CONFIG.autoSend = items.autoSend ?? true;
  if (items.protected_tools) protectedTools = new Set(items.protected_tools);
});

onStorageChanged((changes, namespace) => {
  if (namespace === "sync") {
    if (changes.autoSend) CONFIG.autoSend = changes.autoSend.newValue;
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
