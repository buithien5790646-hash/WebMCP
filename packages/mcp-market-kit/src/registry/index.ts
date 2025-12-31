import { MCPService, Registry } from '../types';
import * as fs from 'fs';
import * as path from 'path';

export class MCPRegistry {
  private services: MCPService[] = [];

  constructor(private registryUrlOrPath?: string, initialServices: MCPService[] = []) {
    this.services = [...initialServices];
  }

  async getServices(): Promise<MCPService[]> {
    let remoteServices: MCPService[] = [];

    if (this.registryUrlOrPath) {
      if (this.registryUrlOrPath.startsWith('http')) {
        // Remote URL
        try {
          const response = await fetch(this.registryUrlOrPath);
          const data = await response.json() as Registry;
          remoteServices = data.services || [];
        } catch (err) {
          console.error('Failed to fetch remote registry:', err);
        }
      } else {
        // Local File Path
        try {
          if (fs.existsSync(this.registryUrlOrPath)) {
            const content = fs.readFileSync(this.registryUrlOrPath, 'utf-8');
            const data = JSON.parse(content) as Registry;
            remoteServices = data.services || [];
          }
        } catch (err) {
          console.error('Failed to read local registry file:', err);
        }
      }
    }

    // Merge services, preferring "remote/file" ones if ID matches
    const localOnly = this.services.filter(ls => !remoteServices.find(rs => rs.id === ls.id));
    return [...localOnly, ...remoteServices];
  }

  async getServiceById(id: string): Promise<MCPService | undefined> {
    const services = await this.getServices();
    return services.find(s => s.id === id);
  }
}
