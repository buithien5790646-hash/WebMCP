import { useState, useEffect } from 'preact/hooks';
import { getSync, setSync, getLocal, setLocal, onStorageChanged, removeStorageListener } from '@/services/storage';

/**
 * Hook for accessing chrome.storage.sync
 */
export function useStorage<T>(key: string, defaultValue: T, workspaceId?: string): [T, (value: T) => void] {
    const [value, setValue] = useState<T>(defaultValue);
    // Only prefix protected_tools, others like autoSend might be global
    const storageKey = (workspaceId && key === 'protected_tools') ? `${workspaceId}_${key}` : key;

    useEffect(() => {
        // Load initial value
        getSync(storageKey as any).then((items) => {
            if (items[storageKey as keyof typeof items] !== undefined) {
                setValue(items[storageKey as keyof typeof items] as any);
            } else {
                setValue(defaultValue);
            }
        });

        // Listen for changes
        const listener = (changes: { [key: string]: chrome.storage.StorageChange }, namespace: string) => {
            if (namespace === 'sync' && changes[storageKey]) {
                setValue(changes[storageKey].newValue);
            }
        };

        onStorageChanged(listener);

        return () => {
            removeStorageListener(listener);
        };
    }, [storageKey, defaultValue]);

    const updateValue = (newValue: T) => {
        setSync({ [storageKey]: newValue } as any).then(() => {
            setValue(newValue);
        });
    };

    return [value, updateValue];
}

/**
 * Hook for accessing chrome.storage.local
 */
export function useLocalStorage<T>(key: string, defaultValue: T, workspaceId?: string): [T, (value: T) => void] {
    const [value, setValue] = useState<T>(defaultValue);
    const storageKey = workspaceId ? `${workspaceId}_${key}` : key;

    useEffect(() => {
        // Load initial value
        getLocal(storageKey as any).then((items) => {
            if (items[storageKey as keyof typeof items] !== undefined) {
                setValue(items[storageKey as keyof typeof items] as any);
            } else {
                setValue(defaultValue);
            }
        });

        // Listen for changes
        const listener = (changes: { [key: string]: chrome.storage.StorageChange }, namespace: string) => {
            if (namespace === 'local' && changes[storageKey]) {
                setValue(changes[storageKey].newValue);
            }
        };

        onStorageChanged(listener);

        return () => {
            removeStorageListener(listener);
        };
    }, [storageKey, defaultValue]);

    const updateValue = (newValue: T) => {
        setLocal({ [storageKey]: newValue } as any).then(() => {
            setValue(newValue);
        });
    };

    return [value, updateValue];
}
