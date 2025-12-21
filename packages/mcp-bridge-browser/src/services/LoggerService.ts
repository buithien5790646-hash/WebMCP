/**
 * Logger Service
 * Manages the floating log window and process logging
 */
export type LogType = "info" | "success" | "error" | "warn" | "action";

class LoggerService {
  private el: HTMLDivElement | null = null;
  private contentEl: HTMLDivElement | null = null;

  /**
   * Initialize the logger UI
   */
  init() {
    if (this.el) return;

    this.el = document.createElement("div");
    Object.assign(this.el.style, {
      position: "fixed",
      top: "20px",
      right: "20px",
      width: "320px",
      height: "200px",
      backgroundColor: "rgba(0, 0, 0, 0.85)",
      color: "#00ff00",
      fontFamily: "Consolas, monospace",
      fontSize: "12px",
      zIndex: "99999",
      borderRadius: "8px",
      display: "none",
      flexDirection: "column",
      border: "1px solid #333",
      backdropFilter: "blur(4px)",
      boxShadow: "0 4px 12px rgba(0, 0, 0, 0.5)",
    });

    const header = document.createElement("div");
    header.innerText = "WebMCP Bridge Process Log";
    Object.assign(header.style, {
      padding: "6px",
      backgroundColor: "#333",
      color: "#fff",
      cursor: "move",
      display: "flex",
      justifyContent: "space-between",
      borderTopLeftRadius: "8px",
      borderTopRightRadius: "8px",
    });

    const clearBtn = document.createElement("span");
    clearBtn.innerText = "🗑️";
    clearBtn.style.cursor = "pointer";
    clearBtn.onclick = () => {
      if (this.contentEl) this.contentEl.innerHTML = "";
    };
    header.appendChild(clearBtn);

    this.contentEl = document.createElement("div");
    Object.assign(this.contentEl.style, {
      flex: "1",
      overflowY: "auto",
      padding: "8px",
    });

    this.el.appendChild(header);
    this.el.appendChild(this.contentEl);
    document.body.appendChild(this.el);
    this.makeDraggable(header);
  }

  private makeDraggable(headerEl: HTMLElement) {
    let isDragging = false;
    let startX: number, startY: number, iLeft: number, iTop: number;

    headerEl.onmousedown = (e) => {
      if (!this.el) return;
      isDragging = true;
      startX = e.clientX;
      startY = e.clientY;
      const r = this.el.getBoundingClientRect();
      iLeft = r.left;
      iTop = r.top;
    };

    window.onmousemove = (e) => {
      if (isDragging && this.el) {
        this.el.style.left = iLeft + e.clientX - startX + "px";
        this.el.style.top = iTop + e.clientY - startY + "px";
        this.el.style.right = "auto";
      }
    };

    window.onmouseup = () => (isDragging = false);
  }

  /**
   * Toggle visibility of the logger
   */
  toggle(show: boolean) {
    if (!this.el && show) this.init();
    if (this.el) this.el.style.display = show ? "flex" : "none";
  }

  /**
   * Log a message
   */
  log(msg: string, type: LogType = "info") {
    if (!this.el || this.el.style.display === "none") return;

    const line = document.createElement("div");
    const time = new Date().toLocaleTimeString("en-US", { hour12: false });
    let icon = "🔹";
    let color = "#ddd";

    switch (type) {
      case "success":
        icon = "✅";
        color = "#4caf50";
        break;
      case "error":
        icon = "❌";
        color = "#f44336";
        break;
      case "warn":
        icon = "⚠️";
        color = "#ff9800";
        break;
      case "action":
        icon = "⚡";
        color = "#00bcd4";
        break;
    }

    line.innerHTML = `<span style="color:#888; font-size:10px">[${time}]</span> ${icon} <span style="color:${color}">${msg}</span>`;
    if (this.contentEl) {
      this.contentEl.appendChild(line);
      this.contentEl.scrollTop = this.contentEl.scrollHeight;
    }
  }
}

export const logger = new LoggerService();
