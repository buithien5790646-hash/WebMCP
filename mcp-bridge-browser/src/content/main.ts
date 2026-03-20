import { StateManager } from './core/StateManager';
import { DefaultPlatformAdapter } from './core/PlatformAdapter';
import { MessageObserver } from './core/MessageObserver';
import { ToolParser } from './core/ToolParser';
import { ToolExecutor } from './core/ToolExecutor';
import { ResponseBatcher } from './core/ResponseBatcher';
import { renderInShadow } from '../components/render';
import { Logger, globalLoggerRef } from '../components/Logger';
import { Messenger } from '../core/messenger';

async function bootstrap() {
  await StateManager.initialize();

  const currentPlatform = StateManager.currentPlatform;
  if (!currentPlatform) {
    console.log("WebMCP: Platform not supported, staying idle.");
    return;
  }

  // 1. Initialize UI (Logger)
  renderInShadow(Logger, {}, 'webmcp-logger-container');

  // 2. Initialize Pipeline
  const adapter = new DefaultPlatformAdapter();
  const observer = new MessageObserver(adapter);
  const parser = new ToolParser();
  const executor = new ToolExecutor(() => {
    observer.scheduleRun();
  });
  const batcher = new ResponseBatcher(
    adapter,
    executor.activeExecutions,
    executor.getResultBuffer(),
    () => setTimeout(() => observer.scheduleRun(), 1000)
  );

  // 3. Wire Pipeline
  observer.onRawBlock((event: any) => {
    parser.parseBlock(event, (payload: any) => {
      executor.executeTool(payload);
    });
  });

  observer.onBatchReady((actionableIds: any) => {
    batcher.processBatch(actionableIds);
  });

  // 4. Start
  const statusResp = await Messenger.getStatus();
  if (statusResp && statusResp.connected) {
    StateManager.isClientConnected = true;
    globalLoggerRef?.log(`WebMCP activated for ${currentPlatform} (Connected)`, "info");
    observer.start();
  } else {
    StateManager.isClientConnected = false;
    console.log(`WebMCP loaded for ${currentPlatform} (Disconnected - Idle)`);
  }
}

bootstrap();
