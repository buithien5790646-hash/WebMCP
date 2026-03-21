import { LocalStorage, SyncStorage } from '../types';

/**
 * 封装 chrome.storage 的类型化服务类
 * 提供对本地存储 (Local Storage) 和同步存储 (Sync Storage) 的便捷访问
 */
export class StorageService {
  /**
   * 获取同步存储数据 (Sync Storage)
   * 该存储区的数据会在用户的多个浏览器实例间自动同步
   *
   * @param keys 要获取的键名，可以是单个字符串或字符串数组
   * @returns 包含请求键值对的 Promise 对象
   */
  static async getSync<K extends keyof SyncStorage>(keys: K | K[]): Promise<Partial<SyncStorage>> {
    return new Promise((resolve) => {
      chrome.storage.sync.get(keys, (items) => resolve(items));
    });
  }

  /**
   * 设置同步存储数据 (Sync Storage)
   *
   * @param items 要保存的键值对对象
   * @returns 操作完成的 Promise
   */
  static async setSync(items: Partial<SyncStorage>): Promise<void> {
    return new Promise((resolve) => {
      chrome.storage.sync.set(items, resolve);
    });
  }

  /**
   * 获取本地存储数据 (Local Storage)
   * 该存储区的数据仅保存在当前浏览器实例中
   *
   * @param keys 要获取的键名，可以是单个字符串、数组或 null（获取所有）
   * @returns 包含请求键值对的 Promise 对象
   */
  static async getLocal<K extends keyof LocalStorage>(keys: K | K[] | null): Promise<Partial<LocalStorage>> {
    return new Promise((resolve) => {
      chrome.storage.local.get(keys, (items) => resolve(items as Partial<LocalStorage>));
    });
  }

  /**
   * 设置本地存储数据 (Local Storage)
   *
   * @param items 要保存的键值对对象
   * @returns 操作完成的 Promise
   */
  static async setLocal(items: Partial<LocalStorage>): Promise<void> {
    return new Promise((resolve) => {
      chrome.storage.local.set(items, resolve);
    });
  }

  /**
   * 监听存储变化事件
   *
   * @param callback 当存储发生变化时触发的回调函数，接收变化详情和存储区域名称（sync/local 等）
   */
  static onChange(
    callback: (
      changes: { [key: string]: chrome.storage.StorageChange },
      areaName: 'sync' | 'local' | 'managed' | 'session'
    ) => void
  ) {
    chrome.storage.onChanged.addListener(callback);
  }
}
