import { PlatformAdapter } from './PlatformAdapter';
import { StateManager } from './StateManager';
import {  LoggerRef  } from '../../components/Logger';
import { t } from '../../core/i18n';

/**
 * 响应批处理类
 * 负责收集所有并发工具调用的执行结果，等所有任务完成后再统一回填到 AI 的输入框中。
 * 这可以防止 AI 模型在多个工具并行执行时，因过早看到部分结果而导致逻辑中断或理解混乱。
 */
export class ResponseBatcher {
  /** 记录已刷新（已输出到输入框）的请求 ID 集合，避免重复输出 */
  private flushedRequests = new Set<string>();
  /** 记录上一次输出进度日志的时间戳，用于节流打印日志 */
  private lastProgressLogTime = 0;
  /** 记录上一次的进度状态字符串，用于避免重复打印相同的进度信息 */
  private lastProgressStatus = "";

  constructor(
    private adapter: PlatformAdapter,
    private activeExecutions: Set<string>,
    private resultBuffer: Map<string, string>,
    private triggerRetry: () => void
  ) { }

  /**
   * 尝试处理当前批次的响应结果
   * @param actionableIds 当前需要处理的工具调用请求 ID 列表
   */
  public processBatch(actionableIds: string[]) {
    // 过滤出尚未刷新过的请求 ID
    const unFlushedIds = actionableIds.filter((id) => !this.flushedRequests.has(id));
    if (unFlushedIds.length === 0) { return; }

    // 统计已完成的工具数量：既不在执行队列中，又在结果缓冲区中有数据
    const completedCount = unFlushedIds.filter(
      (id) => !this.activeExecutions.has(id) && this.resultBuffer.has(id)
    ).length;
    const totalCount = unFlushedIds.length;

    // 当所有提取出来的工具调用都已执行完成时
    if (completedCount === totalCount) {
      // 检查 AI 模型是否仍在生成（比如它还没有输出完整个代码块或回答）
      // 如果还在生成，则稍后再试，防止我们在它没说完话时强行发送数据
      if (this.adapter.isGenerating()) {
        this.triggerRetry();
        return;
      }

      const orderedResults: string[] = [];
      let hasUnflushedContent = false;

      // 按顺序提取结果，确保回填时的顺序与调用顺序一致
      unFlushedIds.forEach((id) => {
        const res = this.resultBuffer.get(id);
        if (res) {
          orderedResults.push(res);
          hasUnflushedContent = true;
        }
      });

      // 如果有实质内容需要输出，且 DOM 选择器已准备好
      if (hasUnflushedContent && StateManager.DOM) {
        LoggerRef.current?.log(`Batch finished: ${orderedResults.length} tools. Writing...`, "success");

        // 将所有结果通过双换行符拼接后回填到网页输入框
        this.adapter.writeToInput(orderedResults.join("\n\n"));

        // 标记这些请求为已处理，并清理缓存
        unFlushedIds.forEach((id) => {
          this.resultBuffer.delete(id);
          this.flushedRequests.add(id);
        });

        // 触发自动发送（如配置允许）
        this.adapter.triggerSend();
      } else {
        // 如果全部是纯虚拟工具（没有实际返回文本输出）
        const anyVirtual = unFlushedIds.some((id) => this.resultBuffer.has(id));
        if (anyVirtual) {
          unFlushedIds.forEach((id) => {
            this.resultBuffer.delete(id);
            this.flushedRequests.add(id);
          });
        }
      }
      this.lastProgressStatus = "";
    } else {
      // 还有工具未完成，处于等待状态
      const statusStr = `${completedCount}/${totalCount}`;
      const now = Date.now();

      // 每隔 3 秒打印一次等待进度，避免刷屏
      if (statusStr !== this.lastProgressStatus || now - this.lastProgressLogTime > 3000) {
        LoggerRef.current?.log(`${t("waiting_tools")} (${statusStr})`, "warn");
        this.lastProgressStatus = statusStr;
        this.lastProgressLogTime = now;
      }
    }
  }
}
