import { Component, h } from 'preact';

interface LogEntry {
  id: string;
  time: string;
  msg: string;
  type: "info" | "success" | "error" | "warn" | "action";
}

interface LoggerProps {}
interface LoggerState {
  logs: LogEntry[];
  visible: boolean;
  position: { left: string; top: string; right: string };
  isDragging: boolean;
}

// Global reference for programmatic logging
export let globalLoggerRef: Logger | null = null;

// eslint-disable-next-line @typescript-eslint/no-unused-vars
const _h = h;
// @ts-ignore
if (typeof _h === 'undefined') { /* noop */ }

export class Logger extends Component<LoggerProps, LoggerState> {
  private contentRef: HTMLDivElement | null = null;
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
    globalLoggerRef = this;
  }

  componentDidUpdate(_prevProps: LoggerProps, prevState: LoggerState) {
    // Auto scroll to bottom
    if (this.state.logs.length > prevState.logs.length && this.contentRef) {
      this.contentRef.scrollTop = this.contentRef.scrollHeight;
    }
  }

  // Exposed API
  toggle(show: boolean) {
    this.setState({ visible: show });
  }

  log(msg: string, type: "info" | "success" | "error" | "warn" | "action" = "info") {
    if (!this.state.visible) return;

    const newLog: LogEntry = {
      id: Date.now() + "_" + Math.random(),
      time: new Date().toLocaleTimeString("en-US", { hour12: false }),
      msg,
      type
    };
    this.setState(prev => ({ logs: [...prev.logs, newLog] }));
  }

  clear = () => {
    this.setState({ logs: [] });
  };

  // Dragging logic
  handleMouseDown = (e: MouseEvent) => {
    this.setState({ isDragging: true });
    this.startX = e.clientX;
    this.startY = e.clientY;

    // Convert to absolute left/top for dragging
    const rect = e.currentTarget instanceof HTMLElement ? e.currentTarget.parentElement?.getBoundingClientRect() : null;
    if (rect) {
      this.iLeft = rect.left;
      this.iTop = rect.top;
      this.setState({ position: { left: `${this.iLeft}px`, top: `${this.iTop}px`, right: 'auto' } });
    }

    window.addEventListener('mousemove', this.handleMouseMove);
    window.addEventListener('mouseup', this.handleMouseUp);
  };

  handleMouseMove = (e: MouseEvent) => {
    if (!this.state.isDragging) return;
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
