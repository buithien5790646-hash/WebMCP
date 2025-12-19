import { useState, useEffect } from 'preact/hooks';
import { getSync, setSync, getLocal, setLocal, onStorageChanged, removeStorageListener } from '@/services/storage';

/**
 * Hook for accessing chrome.storage.sync
 */
export function useStorage<T>(key: string, defaultValue: T): [T, (value: T) => void] {
    const [value, setValue] = useState<T>(defaultValue);

    useEffect(() => {
        // Load initial value
        getSync(key as any).then((items) => {
            if (items[key as keyof typeof items] !== undefined) {
                setValue(items[key as keyof typeof items] as any);
            }
        });

        // Listen for changes
        const listener = (changes: { [key: string]: chrome.storage.StorageChange }, namespace: string) => {
            if (namespace === 'sync' && changes[key]) {
                setValue(changes[key].newValue);
            }
        };

        onStorageChanged(listener);

        return () => {
            removeStorageListener(listener);
        };
    }, [key]);

    const updateValue = (newValue: T) => {
        setSync({ [key]: newValue } as any).then(() => {
            setValue(newValue);
        });
    };

    return [value, updateValue];
}

/**
 * Hook for accessing chrome.storage.local
 */
export function useLocalStorage<T>(key: string, defaultValue: T): [T, (value: T) => void] {
    const [value, setValue] = useState<T>(defaultValue);

    useEffect(() => {
        // Load initial value
        getLocal(key as any).then((items) => {
            if (items[key as keyof typeof items] !== undefined) {
                setValue(items[key as keyof typeof items] as any);
            }
        });

        // Listen for changes
        const listener = (changes: { [key: string]: chrome.storage.StorageChange }, namespace: string) => {
            if (namespace === 'local' && changes[key]) {
                setValue(changes[key].newValue);
            }
        };

        onStorageChanged(listener);

        return () => {
            removeStorageListener(listener);
        };
    }, [key]);

    const updateValue = (newValue: T) => {
        setLocal({ [key]: newValue } as any).then(() => {
            setValue(newValue);
        });
    };

    return [value, updateValue];
}
