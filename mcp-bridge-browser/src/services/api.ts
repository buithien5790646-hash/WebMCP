/**
 * Unified API Client for WebMCP Gateway communication
 * Centralizes all network requests with consistent error handling
 */

interface ApiClientConfig {
    port: number;
    token: string;
}

export class ApiClient {
    private config: ApiClientConfig | null = null;

    /**
     * Initialize the API client with port and token
     */
    configure(port: number, token: string) {
        this.config = { port, token };
    }

    /**
     * Clear the current configuration
     */
    reset() {
        this.config = null;
    }

    /**
     * Check if the client is configured
     */
    isConfigured(): boolean {
        return this.config !== null;
    }

    /**
     * Get the base URL for API requests
     */
    private getBaseUrl(): string {
        if (!this.config) {
            throw new Error('ApiClient not configured. Call configure() first.');
        }
        return `http://127.0.0.1:${this.config.port}`;
    }

    /**
     * Get default headers including auth token
     */
    private getHeaders(): HeadersInit {
        if (!this.config) {
            throw new Error('ApiClient not configured. Call configure() first.');
        }
        return {
            'Content-Type': 'application/json',
            'X-WebMCP-Token': this.config.token,
        };
    }

    /**
     * Execute a tool via the Gateway
     */
    async executeTool(name: string, args: Record<string, any> = {}): Promise<any> {
        const response = await fetch(`${this.getBaseUrl()}/v1/tools/call`, {
            method: 'POST',
            headers: this.getHeaders(),
            body: JSON.stringify({ name, arguments: args }),
        });

        if (!response.ok) {
            if (response.status === 403) {
                throw new Error('Session Expired/Invalid Token');
            }
            throw new Error(`${response.status} - ${response.statusText}`);
        }

        const resJson = await response.json();
        const textContent = resJson.content
            ? resJson.content.map((c: any) => c.text).join('\n')
            : JSON.stringify(resJson);

        return textContent;
    }

    /**
     * Fetch the list of available tools
     */
    async getTools(): Promise<any> {
        const response = await fetch(`${this.getBaseUrl()}/v1/tools`, {
            headers: this.getHeaders(),
        });

        if (!response.ok) {
            throw new Error('Failed to fetch tools');
        }

        return response.json();
    }

    /**
     * Push configuration to the Gateway
     */
    async pushConfig(config: any, workspaceId?: string): Promise<void> {
        let url = `${this.getBaseUrl()}/v1/config`;
        if (workspaceId) url += `?workspaceId=${workspaceId}`;

        const response = await fetch(url, {
            method: 'POST',
            headers: this.getHeaders(),
            body: JSON.stringify({ config }),
        });

        if (!response.ok) {
            throw new Error('Failed to push config');
        }
    }

    /**
     * Pull configuration from the Gateway
     */
    async pullConfig(workspaceId?: string): Promise<any> {
        let url = `${this.getBaseUrl()}/v1/config`;
        if (workspaceId) url += `?workspaceId=${workspaceId}`;

        const response = await fetch(url, {
            headers: this.getHeaders(),
        });

        if (!response.ok) {
            throw new Error('Failed to pull config');
        }

        const data = await response.json();
        return data.config || null;
    }
}

// Export a singleton instance
export const apiClient = new ApiClient();
