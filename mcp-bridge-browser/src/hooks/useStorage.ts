import { useState, useEffect } from 'preact/hooks';

/**
 * Hook for accessing chrome.storage.sync
 */
export function useStorage<T>(key: string, defaultValue: T): [T, (value: T) => void] {
    const [value, setValue] = useState<T>(defaultValue);

    useEffect(() => {
        // Load initial value
        chrome.storage.sync.get([key], (items) => {
            if (items[key] !== undefined) {
                setValue(items[key]);
            }
        });

        // Listen for changes
        const listener = (changes: { [key: string]: chrome.storage.StorageChange }, namespace: string) => {
            if (namespace === 'sync' && changes[key]) {
                setValue(changes[key].newValue);
            }
        };

        chrome.storage.onChanged.addListener(listener);

        return () => {
            chrome.storage.onChanged.removeListener(listener);
        };
    }, [key]);

    const updateValue = (newValue: T) => {
        chrome.storage.sync.set({ [key]: newValue }, () => {
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
        chrome.storage.local.get([key], (items) => {
            if (items[key] !== undefined) {
                setValue(items[key]);
            }
        });

        // Listen for changes
        const listener = (changes: { [key: string]: chrome.storage.StorageChange }, namespace: string) => {
            if (namespace === 'local' && changes[key]) {
                setValue(changes[key].newValue);
            }
        };

        chrome.storage.onChanged.addListener(listener);

        return () => {
            chrome.storage.onChanged.removeListener(listener);
        };
    }, [key]);

    const updateValue = (newValue: T) => {
        chrome.storage.local.set({ [key]: newValue }, () => {
            setValue(newValue);
        });
    };

    return [value, updateValue];
}
