import { StateManager } from './core/StateManager';
import { DefaultPlatformAdapter } from './core/PlatformAdapter';
import { MessageObserver } from './core/MessageObserver';
import { ToolParser } from './core/ToolParser';
import { ToolExecutor } from './core/ToolExecutor';
import { ResponseBatcher } from './core/ResponseBatcher';
import { renderInShadow } from '../components/render';
import { Logger, globalLoggerRef } from '../components/Logger';
import { Messenger } from '../core/messenger';

/**
 * 注入网页的 Content Script 主入口文件
 * 负责组装和启动整个 WebMCP 的核心流水线：
 * 监听 DOM -> 解析工具调用 -> 拦截并执行调用 -> 收集结果 -> 批量回填到网页
 */
async function bootstrap() {
  // 1. 初始化全局状态管理器（识别所处平台、加载用户配置与提示词）
  await StateManager.initialize();

  const currentPlatform = StateManager.currentPlatform;
  if (!currentPlatform) {
    console.log("WebMCP: Platform not supported, staying idle.");
    return;
  }

  // 2. 初始化用户界面 UI
  // 将日志悬浮窗渲染到 Shadow DOM 中，隔离宿主页面的 CSS 样式污染
  renderInShadow(Logger, {}, 'webmcp-logger-container');

  // 3. 实例化流水线核心组件
  const adapter = new DefaultPlatformAdapter();
  const observer = new MessageObserver(adapter);
  const parser = new ToolParser();
  const executor = new ToolExecutor(() => {
    // 每次工具执行完成后，主动调度一次 DOM 检查，以确认是否所有任务都完成
    observer.scheduleRun();
  });
  const batcher = new ResponseBatcher(
    adapter,
    executor.activeExecutions,
    executor.getResultBuffer(),
    // 当检测到模型仍在生成时，稍后触发重试
    () => setTimeout(() => observer.scheduleRun(), 1000)
  );

  // 4. 将各组件连线，建立数据处理管道 (Pipeline)

  // 阶段 A: 当观察者发现潜在的代码块时，交给解析器处理
  observer.onRawBlock((event: any) => {
    parser.parseBlock(event, (payload: any) => {
      // 阶段 B: 解析出合法的工具调用后，交给执行器去拦截/执行
      executor.executeTool(payload);
    });
  });

  // 阶段 C: 当一轮 DOM 检查结束，整理出本轮所有工具调用的 ID，交给批处理器汇总
  observer.onBatchReady((actionableIds: any) => {
    batcher.processBatch(actionableIds);
  });

  // 5. 启动系统
  // 首先向后台询问当前标签页是否已与 VS Code 网关建立有效连接
  const statusResp = await Messenger.getStatus();
  if (statusResp && statusResp.connected) {
    StateManager.isClientConnected = true;
    globalLoggerRef?.log(`WebMCP activated for ${currentPlatform} (Connected)`, "info");
    // 连接正常，启动 DOM 轮询观察器
    observer.start();
  } else {
    StateManager.isClientConnected = false;
    console.log(`WebMCP loaded for ${currentPlatform} (Disconnected - Idle)`);
  }
}

// 启动入口函数
bootstrap();
