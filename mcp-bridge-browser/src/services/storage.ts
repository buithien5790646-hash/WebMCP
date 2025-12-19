/**
 * Type-safe Chrome Storage wrapper
 * Provides strongly-typed access to chrome.storage.local and chrome.storage.sync
 */

export interface StorageSchema {
    // Local Storage
    prompt_en: string;
    prompt_zh: string;
    train_en: string;
    train_zh: string;
    error_en: string;
    error_zh: string;
    user_rules: string;
    cached_tool_list: string[];
    cached_tool_groups: any[];

    // Sync Storage
    autoSend: boolean;
    autoPromptEnabled: boolean;
    customSelectors: any;
    protected_tools: string[];
}

type LocalStorageKeys = 'prompt_en' | 'prompt_zh' | 'train_en' | 'train_zh' | 'error_en' | 'error_zh' | 'user_rules' | 'cached_tool_list' | 'cached_tool_groups';
type SyncStorageKeys = 'autoSend' | 'autoPromptEnabled' | 'customSelectors' | 'protected_tools';

/**
 * Get items from chrome.storage.local
 */
export async function getLocal<K extends LocalStorageKeys>(
    keys: K | K[]
): Promise<Partial<Pick<StorageSchema, K>>> {
    return new Promise((resolve) => {
        chrome.storage.local.get(keys as any, (items) => {
            resolve(items as any);
        });
    });
}

/**
 * Set items in chrome.storage.local
 */
export async function setLocal<K extends LocalStorageKeys>(
    items: Partial<Pick<StorageSchema, K>>
): Promise<void> {
    return new Promise((resolve) => {
        chrome.storage.local.set(items as any, () => {
            resolve();
        });
    });
}

/**
 * Get items from chrome.storage.sync
 */
export async function getSync<K extends SyncStorageKeys>(
    keys: K | K[]
): Promise<Partial<Pick<StorageSchema, K>>> {
    return new Promise((resolve) => {
        chrome.storage.sync.get(keys as any, (items) => {
            resolve(items as any);
        });
    });
}

/**
 * Set items in chrome.storage.sync
 */
export async function setSync<K extends SyncStorageKeys>(
    items: Partial<Pick<StorageSchema, K>>
): Promise<void> {
    return new Promise((resolve) => {
        chrome.storage.sync.set(items as any, () => {
            resolve();
        });
    });
}

/**
 * Listen to storage changes
 */
export function onStorageChanged(
    callback: (changes: { [key: string]: chrome.storage.StorageChange }, namespace: string) => void
) {
    chrome.storage.onChanged.addListener(callback);
}
