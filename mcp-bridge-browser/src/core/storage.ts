import { LocalStorage, SyncStorage } from '../types';

/**
 * Typed wrapper for chrome.storage
 */
export class StorageService {
  /**
   * Sync Storage (Synced across user's browser instances)
   */
  static async getSync<K extends keyof SyncStorage>(keys: K | K[]): Promise<Partial<SyncStorage>> {
    return new Promise((resolve) => {
      chrome.storage.sync.get(keys, (items) => resolve(items));
    });
  }

  static async setSync(items: Partial<SyncStorage>): Promise<void> {
    return new Promise((resolve) => {
      chrome.storage.sync.set(items, resolve);
    });
  }

  /**
   * Local Storage (Specific to this browser instance)
   */
  static async getLocal<K extends keyof LocalStorage>(keys: K | K[] | null): Promise<Partial<LocalStorage>> {
    return new Promise((resolve) => {
      chrome.storage.local.get(keys, (items) => resolve(items as Partial<LocalStorage>));
    });
  }

  static async setLocal(items: Partial<LocalStorage>): Promise<void> {
    return new Promise((resolve) => {
      chrome.storage.local.set(items, resolve);
    });
  }

  /**
   * Listen to storage changes
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
