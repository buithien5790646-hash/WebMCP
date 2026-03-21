import { Component, h } from 'preact';

/**
 * 日志条目结构定义
 */
interface LogEntry {
  id: string;   // 唯一标识，用于 React 列表渲染
  time: string; // 格式化后的时间戳
  msg: string;  // 日志内容
  type: "info" | "success" | "error" | "warn" | "action"; // 日志级别/类型
}

interface LoggerProps {}
interface LoggerState {
  logs: LogEntry[];   // 日志列表
  visible: boolean;   // 窗口是否可见
  position: { left: string; top: string; right: string }; // 窗口当前的位置
  isDragging: boolean;// 窗口是否正在被拖拽
}

// 暴露给全局的引用，方便非 React 代码直接调用其 log() 方法
export const LoggerRef = { current: null as Logger | null };

// 解决 TypeScript 编译器中 h 函数未被使用的误报警告
// eslint-disable-next-line @typescript-eslint/no-unused-vars
const _h = h;
// @ts-ignore
if (typeof _h === 'undefined') { /* noop */ }

/**
 * 页面级悬浮日志窗口组件
 * 提供一个可拖拽的半透明窗口，实时显示 WebMCP 内部的工作流水线状态
 */
export class Logger extends Component<LoggerProps, LoggerState> {
  private contentRef: HTMLDivElement | null = null;
  // 拖拽起始点与元素的初始绝对坐标
  private startX = 0;
  private startY = 0;
  private iLeft = 0;
  private iTop = 0;

  constructor(props: LoggerProps) {
    super(props);
    this.state = {
      logs: [],
      visible: false,
      position: { left: 'auto', top: '20px', right: '20px' },
      isDragging: false
    };
  }

  componentDidMount() {
    LoggerRef.current = this;
  }

  componentWillUnmount() {
    if (LoggerRef.current === this) {
      LoggerRef.current = null;
    }
  }

  /** 组件更新生命周期钩子 */
  componentDidUpdate(_prevProps: LoggerProps, prevState: LoggerState) {
    // 自动滚动到最新的一条日志
    if (this.state.logs.length > prevState.logs.length && this.contentRef) {
      this.contentRef.scrollTop = this.contentRef.scrollHeight;
    }
  }

  // === 暴露的 API ===

  /** 切换日志窗口显示状态 */
  toggle(show: boolean) {
    this.setState({ visible: show });
  }

  /**
   * 写入一条新的日志记录
   * @param msg 消息正文
   * @param type 消息类型（决定左侧的图标和字体颜色）
   */
  log(msg: string, type: "info" | "success" | "error" | "warn" | "action" = "info") {
    // 优化：如果日志窗口当前被隐藏，则不积累 DOM 节点以节省内存
    if (!this.state.visible) return;

    const newLog: LogEntry = {
      id: Date.now() + "_" + Math.random(),
      time: new Date().toLocaleTimeString("en-US", { hour12: false }),
      msg,
      type
    };
    this.setState(prev => ({ logs: [...prev.logs, newLog] }));
  }

  /** 清空所有当前显示的日志 */
  clear = () => {
    this.setState({ logs: [] });
  };

  // === 窗口拖拽逻辑 ===

  handleMouseDown = (e: MouseEvent) => {
    this.setState({ isDragging: true });
    this.startX = e.clientX;
    this.startY = e.clientY;

    // 获取当前元素的绝对 left 和 top 坐标
    const rect = e.currentTarget instanceof HTMLElement ? e.currentTarget.parentElement?.getBoundingClientRect() : null;
    if (rect) {
      this.iLeft = rect.left;
      this.iTop = rect.top;
      // 切换为 left/top 绝对定位，取消 right 定位，防止拖动时抖动
      this.setState({ position: { left: `${this.iLeft}px`, top: `${this.iTop}px`, right: 'auto' } });
    }

    // 在 Window 上监听 mousemove，这样即使用户鼠标移出了元素范围，依然能继续拖拽
    window.addEventListener('mousemove', this.handleMouseMove);
    window.addEventListener('mouseup', this.handleMouseUp);
  };

  handleMouseMove = (e: MouseEvent) => {
    if (!this.state.isDragging) return;
    // 根据鼠标位移量计算新的窗口位置
    this.setState({
      position: {
        left: `${this.iLeft + e.clientX - this.startX}px`,
        top: `${this.iTop + e.clientY - this.startY}px`,
        right: 'auto'
      }
    });
  };

  handleMouseUp = () => {
    this.setState({ isDragging: false });
    window.removeEventListener('mousemove', this.handleMouseMove);
    window.removeEventListener('mouseup', this.handleMouseUp);
  };

  /** 根据日志类型获取对应的 Emoji 图标和颜色 */
  getIconAndColor(type: string) {
    switch (type) {
      case "success": return { icon: "✅", color: "#4caf50" };
      case "error": return { icon: "❌", color: "#f44336" };
      case "warn": return { icon: "⚠️", color: "#ff9800" };
      case "action": return { icon: "⚡", color: "#00bcd4" };
      default: return { icon: "🔹", color: "#ddd" };
    }
  }

  render() {
    if (!this.state.visible) return null;

    const { position, logs } = this.state;

    return (
      <div style={{
        position: "fixed",
        ...position,
        width: "320px",
        height: "200px",
        backgroundColor: "rgba(0,0,0,0.85)",
        color: "#00ff00",
        fontFamily: "Consolas, monospace",
        fontSize: "12px",
        zIndex: 99999,
        borderRadius: "8px",
        display: "flex",
        flexDirection: "column",
        border: "1px solid #333",
        backdropFilter: "blur(4px)",
        boxShadow: "0 4px 12px rgba(0,0,0,0.5)",
      }}>
        {/* 顶部可拖拽区域标题栏 */}
        <div
          onMouseDown={this.handleMouseDown}
          style={{
            padding: "6px",
            backgroundColor: "#333",
            color: "#fff",
            cursor: "move",
            display: "flex",
            justifyContent: "space-between",
            borderRadius: "8px 8px 0 0"
          }}>
          <span>WebMCP Bridge Process Log</span>
          <span style={{ cursor: "pointer" }} onClick={this.clear}>🗑️</span>
        </div>

        {/* 日志列表内容区 */}
        <div
          ref={el => { if (el) this.contentRef = el; }}
          style={{
            flex: "1",
            overflowY: "auto",
            padding: "8px",
          }}>
          {logs.map(log => {
            const { icon, color } = this.getIconAndColor(log.type);
            return (
              <div key={log.id} style={{ marginBottom: "2px" }}>
                <span style={{ color: "#888", fontSize: "10px" }}>[{log.time}]</span> {icon}{" "}
                <span style={{ color }}>{log.msg}</span>
              </div>
            );
          })}
        </div>
      </div>
    );
  }
}
