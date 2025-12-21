export interface IMCPStorage {
    get<T>(key: string): T | undefined;
    update(key: string, value: any): Promise<void>;
}
