import { ExtensionMessage, ExecuteToolResponse, HandshakeResponse, StatusResponse } from '../types';

/**
 * 跨脚本通信服务类 (background <-> content/popup)
 * 封装了 chrome.runtime.sendMessage 相关的操作，并提供类型安全的 Promise 接口
 */
export class Messenger {
  /**
   * 发送 EXECUTE_TOOL (执行工具) 消息到后台脚本
   *
   * @param payload 包含工具名称和参数的消息载荷
   * @returns 包含工具执行结果的 Promise 对象
   */
  static async executeTool(payload: ExtensionMessage & { type: 'EXECUTE_TOOL' }): Promise<ExecuteToolResponse> {
    return new Promise((resolve) => {
      chrome.runtime.sendMessage(payload, (response: ExecuteToolResponse) => {
        // 如果没有收到响应，则返回错误信息以防 Promise 挂起
        resolve(response || { success: false, error: 'No response from background script' });
      });
    });
  }

  /**
   * 发送 HANDSHAKE (握手) 消息到后台脚本
   * 用于建立连接并传递目标网页的 origin 等信息
   *
   * @param payload 包含源信息的消息载荷
   * @returns 包含握手结果的 Promise 对象
   */
  static async handshake(payload: ExtensionMessage & { type: 'HANDSHAKE' }): Promise<HandshakeResponse> {
    return new Promise((resolve) => {
      chrome.runtime.sendMessage(payload, (response: HandshakeResponse) => {
        // 处理扩展内部错误 (如无法连接到后台脚本)
        if (chrome.runtime.lastError) {
          resolve({ success: false, error: chrome.runtime.lastError.message });
          return;
        }
        resolve(response || { success: false, error: 'Empty handshake response' });
      });
    });
  }

  /**
   * 发送 GET_STATUS (获取状态) 消息到后台脚本
   * 用于查询当前与 VS Code Gateway 的连接状态
   *
   * @returns 包含连接状态信息的 Promise 对象
   */
  static async getStatus(): Promise<StatusResponse> {
    return new Promise((resolve) => {
      chrome.runtime.sendMessage({ type: 'GET_STATUS' }, (response: StatusResponse) => {
        resolve(response || { connected: false });
      });
    });
  }

  /**
   * 广播一个通知消息到后台脚本，要求其显示系统通知
   *
   * @param title 通知标题
   * @param message 通知正文内容
   */
  static showNotification(title: string, message: string): void {
    chrome.runtime.sendMessage({ type: 'SHOW_NOTIFICATION', title, message });
  }

  /**
   * 设置一个监听器，处理传入的扩展消息
   *
   * @param callback 处理消息的回调函数，如果需要异步发送响应，回调应返回 true
   */
  static onMessage(callback: (message: ExtensionMessage, sender: chrome.runtime.MessageSender, sendResponse: (response?: any) => void) => boolean | void) {
    chrome.runtime.onMessage.addListener(callback as any);
  }
}
