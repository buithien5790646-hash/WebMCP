import { Session } from '@/types';
import { SessionSchema } from '@/types/schemas';
import { getLocal, setLocal, removeLocal, browserService, ErrorHandler } from '@/services';

export class SessionManager {
    /**
     * Get session for a specific tab
     */
    async getSession(tabId: number): Promise<Session | undefined> {
        const key = `session_${tabId}`;
        const result = await getLocal(key as any);
        const data = (result as any)[key];
        if (!data) return undefined;

        const parse = SessionSchema.safeParse(data);
        if (parse.success) {
            return parse.data;
        } else {
            ErrorHandler.report(parse.error, `SessionManager.getSession(${tabId})`);
            return undefined;
        }
    }

    /**
     * Save session for a specific tab
     */
    async saveSession(tabId: number, data: Session) {
        const key = `session_${tabId}`;
        await setLocal({ [key]: data } as any);
    }

    /**
     * Update showLog flag for a session
     */
    async updateSessionLog(tabId: number, showLog: boolean) {
        const session = await this.getSession(tabId);
        if (session) {
            session.showLog = showLog;
            await this.saveSession(tabId, session);
        }
    }

    /**
     * Remove session and update UI
     */
    async removeSession(tabId: number) {
        const key = `session_${tabId}`;
        await removeLocal(key);
        // Notify Content Script
        browserService.sendMessage({ type: "STATUS_UPDATE", connected: false }, tabId).catch(() => { });
        this.updateBadge(tabId, false);
    }

    /**
     * Clear specific null session key (cleanup)
     */
    async clearNullSession() {
        await removeLocal("session_null" as any);
    }

    /**
     * Check for conflicting sessions on a specific port
     */
    async findConflictTabId(port: number, currentTabId: number): Promise<string | null> {
        const all = await getLocal(null);
        const entries = Object.entries(all || {});
        for (const [key, val] of entries) {
            const sessionData = val as any as Session;
            if (
                key.startsWith("session_") &&
                sessionData.port === port &&
                key !== `session_${currentTabId}`
            ) {
                return key.replace("session_", "");
            }
        }
        return null;
    }

    /**
     * Update extension badge state
     */
    updateBadge(tabId: number, active: boolean) {
        if (active) {
            browserService.setBadgeText("ON", tabId);
            browserService.setBadgeBackgroundColor("#4CAF50", tabId);
        } else {
            browserService.setBadgeText("", tabId);
        }
    }
}

export const sessionManager = new SessionManager();
