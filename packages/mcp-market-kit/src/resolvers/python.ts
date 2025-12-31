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

    return {
      command: pythonPath,
      args: ['-m', pkgName],
      env: { ...(process.env as Record<string, string>), ...env }
    };
  }
}
