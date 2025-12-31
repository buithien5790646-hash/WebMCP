export type MCPServiceType = 'node' | 'python' | 'docker';

export interface MCPService {
  id: string;          // Unique identifier
  name: string;
  description?: string;
  author?: string;
  icon?: string;       // Icon name or URL
  type: MCPServiceType;
  metadata: {
    npmPackage?: string;
    pythonPackage?: string;
    dockerImage?: string;
    version?: string;
    repoUrl?: string;
  };
  variables?: {
    env?: Array<{
      key: string;
      label: string;
      placeholder?: string;
      description?: string;
      required?: boolean;
    }>;
    args?: Array<{
      label: string;
      placeholder?: string;
      description?: string;
      type: 'text' | 'path';
      required?: boolean;
    }>;
  };
}

export interface ServiceConfig {
  command: string;     // Execution command (node/python/docker)
  args: string[];      // Arguments (absolute paths or image names)
  env?: Record<string, string>;
}

export interface MCPOptions {
  rootDir: string;     // SDK data root directory
  registryUrl?: string; // Kept for compatibility, mapped to registryUrlOrPath
  registryUrlOrPath?: string;
  initialServices?: MCPService[]; // Initial local services
}

export interface InstallResult {
  success: boolean;
  path: string;
  version?: string;
}

export interface Registry {
  version: string;
  services: MCPService[];
}
