import * as path from 'path';
import * as fs from 'fs';
import { ServiceConfig } from '../types';

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

    // On Windows, sometimes running with -m doesn't work well in certain environments 
    // or requires the full path to the module's entry point if it's not correctly exposed.
    // However, the most common way to run MCP servers is as a module.
    // If it fails with 'Connection closed', it might be because the server is printing 
    // something to stdout that is NOT JSON-RPC.
    
    return {
      command: pythonPath,
      args: ['-u', '-m', pkgName], // Add -u for unbuffered output to ensure logs/RPC are sent immediately
      env: { 
        ...(process.env as Record<string, string>), 
        ...env,
        PYTHONUNBUFFERED: "1" 
      }
    };
  }
}
