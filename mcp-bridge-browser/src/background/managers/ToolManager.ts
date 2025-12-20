import { apiClient } from '@/services/api';
import { getLocal, setLocal, getSync, setSync } from '@/services/storage';
import { ToolExecutionSchema } from '@/types/schemas';

export class ToolManager {
    /**
     * Prefetch and cache the tool list from Gateway
     */
    async prefetchToolList() {
        try {
            if (!apiClient.isConfigured()) return;

            const json = await apiClient.getTools();
            const rawGroups = json.groups || [];
            const newToolNames: string[] = [];

            rawGroups.forEach((g: any) => {
                if (g.tools) g.tools.forEach((t: any) => newToolNames.push(t.name));
            });

            // HITL Security: Auto-protect new tools
            const localData = await getLocal(["cached_tool_list"] as any);
            const syncData = await getSync(["protected_tools"] as any);

            const knownTools = new Set(localData.cached_tool_list || []);
            const protectedTools = new Set(syncData.protected_tools || []);
            let protectedDirty = false;

            newToolNames.forEach((tName: string) => {
                if (!knownTools.has(tName)) {
                    if (!protectedTools.has(tName)) {
                        protectedTools.add(tName);
                        protectedDirty = true;
                    }
                }
            });

            if (protectedDirty) {
                await setSync({
                    protected_tools: Array.from(protectedTools),
                } as any);
            }

            await setLocal({
                cached_tool_list: newToolNames,
                cached_tool_groups: rawGroups
            } as any);
        } catch (e) {
            console.error("[WebMCP] Tool prefetch failed:", e);
        }
    }

    /**
     * Execute a tool via ApiClient
     */
    async executeTool(name: string, args: any) {
        // Validate arguments
        const parse = ToolExecutionSchema.safeParse({ name, arguments: args });
        if (!parse.success) {
            return { success: false, error: `Invalid tool arguments: ${parse.error.message}` };
        }

        try {
            const textContent = await apiClient.executeTool(name, args || {});
            return { success: true, data: textContent };
        } catch (err: any) {
            return { success: false, error: err.message };
        }
    }
}

export const toolManager = new ToolManager();
