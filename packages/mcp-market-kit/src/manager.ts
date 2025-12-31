import { MCPOptions, MCPService, ServiceConfig } from './types';
import { NodeInstaller } from './installer';
import { PythonInstaller, DockerInstaller } from './installers';
import { NodeResolver } from './resolver';
import { PythonResolver, DockerResolver } from './resolvers';
import { MCPRegistry } from './registry';
import * as fs from 'fs';
import { DEFAULT_ROOT_DIR } from './constants';

export class MCPManager {
  private options: MCPOptions;
  private nodeInstaller: NodeInstaller;
  private pythonInstaller: PythonInstaller;
  private dockerInstaller: DockerInstaller;
  private nodeResolver: NodeResolver;
  private pythonResolver: PythonResolver;
  private dockerResolver: DockerResolver;
  public registry: MCPRegistry;

  constructor(options?: Partial<MCPOptions>) {
    this.options = {
      rootDir: options?.rootDir || DEFAULT_ROOT_DIR,
      registryUrl: options?.registryUrl,
      initialServices: options?.initialServices || []
    };

    // Ensure root exists
    if (!fs.existsSync(this.options.rootDir)) {
       fs.mkdirSync(this.options.rootDir, { recursive: true });
    }

    this.nodeInstaller = new NodeInstaller(this.options.rootDir);
    this.pythonInstaller = new PythonInstaller(this.options.rootDir);
    this.dockerInstaller = new DockerInstaller();
    
    this.nodeResolver = new NodeResolver(this.options.rootDir);
    this.pythonResolver = new PythonResolver(this.options.rootDir);
    this.dockerResolver = new DockerResolver();

    this.registry = new MCPRegistry(this.options.registryUrl, this.options.initialServices);
  }

  /**
   * List available services from the registry
   */
  async getMarketplaceServices(): Promise<MCPService[]> {
    return this.registry.getServices();
  }

  /**
   * Install a service
   */
  async install(service: MCPService): Promise<boolean> {
    switch (service.type) {
      case 'node': {
        const npmPkg = service.metadata.npmPackage || service.id;
        return this.nodeInstaller.install(service.id, npmPkg, service.metadata.version);
      }
      case 'python': {
        const pyPkg = service.metadata.pythonPackage || service.id;
        return this.pythonInstaller.install(service.id, pyPkg, service.metadata.version);
      }
      case 'docker':
        if (!service.metadata.dockerImage) throw new Error('Docker image is required for docker type services');
        return this.dockerInstaller.install(service.id, service.metadata.dockerImage);
      default:
        throw new Error(`Unsupported service type: ${service.type}`);
    }
  }

  /**
   * Get the command to run the service.
   */
  async resolve(serviceId: string, env: Record<string, string> = {}): Promise<ServiceConfig> {
    const service = await this.registry.getServiceById(serviceId);
    if (!service) {
      // If not in registry, try to infer or fallback to node
      return this.nodeResolver.resolve(serviceId, env);
    }

    switch (service.type) {
      case 'node':
        return this.nodeResolver.resolve(serviceId, env);
      case 'python': {
        const pyPkg = service.metadata.pythonPackage || service.id;
        return this.pythonResolver.resolve(serviceId, pyPkg, env);
      }
      case 'docker':
        if (!service.metadata.dockerImage) throw new Error('Docker image is required for docker type services');
        return this.dockerResolver.resolve(serviceId, service.metadata.dockerImage, env);
      default:
        throw new Error(`Unsupported service type: ${service.type}`);
    }
  }

  /**
   * Check if service is installed
   */
  isInstalled(serviceId: string): boolean {
    // For simplicity, we check all installers. In a better impl, we'd check the registry first.
    return this.nodeInstaller.checkInstalled(serviceId) || 
           this.pythonInstaller.checkInstalled(serviceId) ||
           this.dockerInstaller.checkInstalled(serviceId);
  }
}