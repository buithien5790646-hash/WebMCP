import { MCPService, Registry } from './types';

export class MCPRegistry {
  private services: MCPService[] = [];

  constructor(private registryUrl?: string, initialServices: MCPService[] = []) {
    this.services = [...initialServices];
  }

  async getServices(): Promise<MCPService[]> {
    if (this.registryUrl) {
      try {
        const response = await fetch(this.registryUrl);
        const data = await response.json() as Registry;
        // Merge remote services with local ones, preferring remote if ID matches
        const remoteServices = data.services || [];
        const localOnly = this.services.filter(ls => !remoteServices.find(rs => rs.id === ls.id));
        return [...localOnly, ...remoteServices];
      } catch (err) {
        console.error('Failed to fetch remote registry, falling back to local services:', err);
        return this.services;
      }
    }
    return this.services;
  }

  async getServiceById(id: string): Promise<MCPService | undefined> {
    const services = await this.getServices();
    return services.find(s => s.id === id);
  }
}
