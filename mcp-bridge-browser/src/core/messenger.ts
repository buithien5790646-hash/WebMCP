import { ExtensionMessage, ExecuteToolResponse, HandshakeResponse, StatusResponse } from '../types';

/**
 * Typed cross-script communication (background <-> content/popup).
 */
export class Messenger {
  /**
   * Send an EXECUTE_TOOL message to the background script.
   */
  static async executeTool(payload: ExtensionMessage & { type: 'EXECUTE_TOOL' }): Promise<ExecuteToolResponse> {
    return new Promise((resolve) => {
      chrome.runtime.sendMessage(payload, (response: ExecuteToolResponse) => {
        resolve(response || { success: false, error: 'No response from background script' });
      });
    });
  }

  /**
   * Send a HANDSHAKE message to the background script.
   */
  static async handshake(payload: ExtensionMessage & { type: 'HANDSHAKE' }): Promise<HandshakeResponse> {
    return new Promise((resolve) => {
      chrome.runtime.sendMessage(payload, (response: HandshakeResponse) => {
        if (chrome.runtime.lastError) {
          resolve({ success: false, error: chrome.runtime.lastError.message });
          return;
        }
        resolve(response || { success: false, error: 'Empty handshake response' });
      });
    });
  }

  /**
   * Send a GET_STATUS message to the background script.
   */
  static async getStatus(): Promise<StatusResponse> {
    return new Promise((resolve) => {
      chrome.runtime.sendMessage({ type: 'GET_STATUS' }, (response: StatusResponse) => {
        resolve(response || { connected: false });
      });
    });
  }

  /**
   * Broadcast a notification to the background script.
   */
  static showNotification(title: string, message: string): void {
    chrome.runtime.sendMessage({ type: 'SHOW_NOTIFICATION', title, message });
  }

  /**
   * Setup a listener for incoming messages.
   */
  static onMessage(callback: (message: ExtensionMessage, sender: chrome.runtime.MessageSender, sendResponse: (response?: any) => void) => boolean | void) {
    chrome.runtime.onMessage.addListener(callback as any);
  }
}
