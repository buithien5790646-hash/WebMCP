import { i18n } from '../services/i18n';

/**
 * Hook for accessing i18n translations
 */
export function useI18n() {
    return {
        t: (key: string) => i18n.t(key),
        lang: i18n.lang,
    };
}
