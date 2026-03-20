import { Session } from '../types';
import { StorageService } from '../core/storage';

export class SessionManager {
  /**
   * Check if a URL matches the extension's allowed hosts in manifest.
   */
  static isUrlAllowed(url: string | undefined): boolean {
    if (!url) { return false; }
    const manifest = chrome.runtime.getManifest();

    const hostPatterns = manifest.host_permissions || [];
    const scriptPatterns = (manifest.content_scripts || []).flatMap((cs) => cs.matches || []);
    const allPatterns = [...new Set([...hostPatterns, ...scriptPatterns])];

    return allPatterns.some((pattern) => {
      const base = pattern.replace(/\*$/, "");
      return url.startsWith(base) || url === base.replace(/\/$/, "");
    });
  }

  static async getSession(tabId: number): Promise<Session | undefined> {
    const key = `session_${tabId}` as any;
    const result = await StorageService.getLocal([key]);
    return result[key] as any as Session;
  }

  static async saveSession(tabId: number, data: Session): Promise<void> {
    const key = `session_${tabId}` as any;
    await StorageService.setLocal({ [key]: data });
  }

  static async removeSession(tabId: number): Promise<void> {
    const key = `session_${tabId}`;
    await chrome.storage.local.remove(key);
    // Notify Content Script
    chrome.tabs.sendMessage(tabId, { type: "STATUS_UPDATE", connected: false }).catch(() => { });
  }

  static async updateSessionLog(tabId: number, showLog: boolean): Promise<void> {
    const session = await this.getSession(tabId);
    if (session) {
      session.showLog = showLog;
      await this.saveSession(tabId, session);
    }
  }

  static updateBadge(tabId: number, active: boolean): void {
    if (active) {
      chrome.action.setBadgeText({ tabId, text: "ON" });
      chrome.action.setBadgeBackgroundColor({ tabId, color: "#4CAF50" });
    } else {
      chrome.action.setBadgeText({ tabId, text: "" });
    }
  }
}
