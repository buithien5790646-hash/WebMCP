/**
 * Browser Service
 * Unified wrapper for chrome.runtime, chrome.tabs, and other browser APIs
 */
class BrowserService {
    /**
     * Send a message to background script or specific tab
     */
    async sendMessage(message: any, tabId?: number): Promise<any> {
        return new Promise((resolve) => {
            if (tabId !== undefined) {
                chrome.tabs.sendMessage(tabId, message, (response) => {
                    resolve(response);
                });
            } else {
                chrome.runtime.sendMessage(message, (response) => {
                    resolve(response);
                });
            }
        });
    }

    /**
     * Listen for messages
     */
    onMessage(callback: (message: any, sender: chrome.runtime.MessageSender, sendResponse: (response?: any) => void) => void | boolean) {
        chrome.runtime.onMessage.addListener(callback);
    }

    /**
     * Remove message listener
     */
    removeMessageListener(callback: (message: any, sender: chrome.runtime.MessageSender, sendResponse: (response?: any) => void) => void | boolean) {
        chrome.runtime.onMessage.removeListener(callback);
    }

    /**
     * Get the current active tab in the current window
     */
    async getActiveTab(): Promise<chrome.tabs.Tab | undefined> {
        return new Promise((resolve) => {
            chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
                resolve(tabs[0]);
            });
        });
    }

    /**
     * Open the extension options page
     */
    openOptionsPage() {
        chrome.runtime.openOptionsPage();
    }

    /**
     * Get absolute URL for a resource within the extension
     */
    getURL(path: string): string {
        return chrome.runtime.getURL(path);
    }

    /**
     * Set the extension badge text
     */
    setBadgeText(text: string, tabId?: number) {
        chrome.action.setBadgeText({ text, tabId });
    }

    /**
     * Set the extension badge background color
     */
    setBadgeBackgroundColor(color: string, tabId?: number) {
        chrome.action.setBadgeBackgroundColor({ color, tabId });
    }

    /**
     * Get extension manifest
     */
    getManifest(): chrome.runtime.Manifest {
        return chrome.runtime.getManifest();
    }

    /**
     * Listen for extension installation or update
     */
    onInstalled(callback: (details: chrome.runtime.InstalledDetails) => void) {
        chrome.runtime.onInstalled.addListener(callback);
    }

    /**
     * Listen for tab updates
     */
    onTabsUpdated(callback: (tabId: number, changeInfo: chrome.tabs.TabChangeInfo, tab: chrome.tabs.Tab) => void) {
        chrome.tabs.onUpdated.addListener(callback);
    }

    /**
     * Listen for tab removal
     */
    onTabsRemoved(callback: (tabId: number, removeInfo: chrome.tabs.TabRemoveInfo) => void) {
        chrome.tabs.onRemoved.addListener(callback);
    }

    /**
     * Get a specific tab by ID
     */
    async getTab(tabId: number): Promise<chrome.tabs.Tab | undefined> {
        return new Promise((resolve) => {
            chrome.tabs.get(tabId, (tab) => {
                if (chrome.runtime.lastError) {
                    resolve(undefined);
                } else {
                    resolve(tab);
                }
            });
        });
    }

    /**
     * Create a desktop notification
     */
    createNotification(options: chrome.notifications.NotificationOptions) {
        chrome.notifications.create(options as any);
    }
}

export const browserService = new BrowserService();
