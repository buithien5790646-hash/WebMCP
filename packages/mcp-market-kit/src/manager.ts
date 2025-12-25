import { MCPOptions, MCPService, ServiceConfig } from './types';
import { NodeInstaller } from './installer';
import { NodeResolver } from './resolver';
import * as path from 'path';
import * as fs from 'fs';
import { DEFAULT_ROOT_DIR } from './constants';

export class MCPManager {
  private options: MCPOptions;
  private installer: NodeInstaller;
  private resolver: NodeResolver;

  constructor(options?: Partial<MCPOptions>) {
    this.options = {
      rootDir: options?.rootDir || DEFAULT_ROOT_DIR,
      registryUrl: options?.registryUrl
    };

    // Ensure root exists
    if (!fs.existsSync(this.options.rootDir)) {
       fs.mkdirSync(this.options.rootDir, { recursive: true });
    }

    this.installer = new NodeInstaller(this.options.rootDir);
    this.resolver = new NodeResolver(this.options.rootDir);
  }

  /**
   * Install a service by name (e.g., "@modelcontextprotocol/server-filesystem")
   */
  async install(service: MCPService): Promise<boolean> {
    if (service.type !== 'node') {
      throw new Error('Only node services are supported in this version.');
    }

    const pkgName = service.metadata.npmPackage || service.id;
    return this.installer.install(service.id, pkgName, service.metadata.version);
  }

  /**
   * Get the command to run the service. 
   * This resolves the absolute path to the entry point, bypassing npx.
   */
  async resolve(serviceId: string, env: Record<string, string> = {}): Promise<ServiceConfig> {
    return this.resolver.resolve(serviceId, env);
  }

  /**
   * Check if service is installed
   */
  isInstalled(serviceId: string): boolean {
    return this.installer.checkInstalled(serviceId);
  }
}