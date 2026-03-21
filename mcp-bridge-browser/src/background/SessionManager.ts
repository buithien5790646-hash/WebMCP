import { Session } from '../types';
import { StorageService } from '../core/storage';

/**
 * 会话管理器类
 * 用于管理每个标签页的 WebMCP 连接会话状态、权限校验以及扩展图标状态更新
 */
export class SessionManager {
  /**
   * 检查指定的 URL 是否在 manifest.json 中声明的允许权限列表中
   * 这是一种安全防范机制，防止扩展注入到不支持或不安全的域名下
   *
   * @param url 要检查的页面 URL
   * @returns 是否允许注入和运行
   */
  static isUrlAllowed(url: string | undefined): boolean {
    if (!url) { return false; }
    const manifest = chrome.runtime.getManifest();

    // 收集 host_permissions 和 content_scripts.matches 中声明的匹配模式
    const hostPatterns = manifest.host_permissions || [];
    const scriptPatterns = (manifest.content_scripts || []).flatMap((cs) => cs.matches || []);
    // 合并并去重
    const allPatterns = [...new Set([...hostPatterns, ...scriptPatterns])];

    return allPatterns.some((pattern) => {
      // 简单处理匹配模式，去掉末尾的星号，然后检查前缀是否匹配
      const base = pattern.replace(/\*$/, "");
      return url.startsWith(base) || url === base.replace(/\/$/, "");
    });
  }

  /**
   * 获取指定标签页当前的 WebMCP 会话数据
   *
   * @param tabId 标签页 ID
   * @returns 包含认证 Token 和端口信息的会话对象，若不存在则返回 undefined
   */
  static async getSession(tabId: number): Promise<Session | undefined> {
    const key = `session_${tabId}` as any;
    const result = await StorageService.getLocal([key]);
    return result[key] as any as Session;
  }

  /**
   * 为指定标签页保存新的会话数据
   *
   * @param tabId 标签页 ID
   * @param data 要保存的会话对象
   */
  static async saveSession(tabId: number, data: Session): Promise<void> {
    const key = `session_${tabId}` as any;
    await StorageService.setLocal({ [key]: data });
  }

  /**
   * 移除指定标签页的会话数据，并通知页面端断开连接状态
   *
   * @param tabId 标签页 ID
   */
  static async removeSession(tabId: number): Promise<void> {
    const key = `session_${tabId}`;
    await chrome.storage.local.remove(key);
    // 异步通知 Content Script 更新为未连接状态
    chrome.tabs.sendMessage(tabId, { type: "STATUS_UPDATE", connected: false }).catch(() => { });
  }

  /**
   * 更新指定标签页会话的日志显示状态
   *
   * @param tabId 标签页 ID
   * @param showLog 是否显示悬浮日志窗口
   */
  static async updateSessionLog(tabId: number, showLog: boolean): Promise<void> {
    const session = await this.getSession(tabId);
    if (session) {
      session.showLog = showLog;
      await this.saveSession(tabId, session);
    }
  }

  /**
   * 更新浏览器工具栏中扩展图标的徽章状态
   *
   * @param tabId 标签页 ID
   * @param active 是否处于连接/激活状态
   */
  static updateBadge(tabId: number, active: boolean): void {
    if (active) {
      // 显示绿色的 "ON" 状态
      chrome.action.setBadgeText({ tabId, text: "ON" });
      chrome.action.setBadgeBackgroundColor({ tabId, color: "#4CAF50" });
    } else {
      // 清除徽章
      chrome.action.setBadgeText({ tabId, text: "" });
    }
  }
}
