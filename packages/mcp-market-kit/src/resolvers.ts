import * as path from 'path';
import * as fs from 'fs';
import { ServiceConfig } from './types';

export class PythonResolver {
  constructor(private rootDir: string) {}

  async resolve(serviceId: string, pkgName: string, env: Record<string, string> = {}): Promise<ServiceConfig> {
    const serviceDir = path.join(this.rootDir, 'services', serviceId);
    const venvDir = path.join(serviceDir, 'venv');
    
    if (!fs.existsSync(venvDir)) {
      throw new Error(`Service ${serviceId} is not installed (venv not found).`);
    }

    const pythonPath = process.platform === 'win32' 
      ? path.join(venvDir, 'Scripts', 'python.exe') 
      : path.join(venvDir, 'bin', 'python');

    // For python MCP servers, we usually run them via 'python -m package_name'
    return {
      command: pythonPath,
      args: ['-m', pkgName],
      env: { ...(process.env as Record<string, string>), ...env }
    };
  }
}

export class DockerResolver {
  constructor() {}

  async resolve(serviceId: string, image: string, env: Record<string, string> = {}): Promise<ServiceConfig> {
    // Construct docker run command
    // We might need to add more flags like --rm, -it, etc.
    const args = ['run', '--rm', '-i'];
    
    // Add environment variables
    Object.entries(env).forEach(([key, value]) => {
      args.push('-e', `${key}=${value}`);
    });

    args.push(image);

    return {
      command: 'docker',
      args,
      env: { ...(process.env as Record<string, string>) }
    };
  }
}
