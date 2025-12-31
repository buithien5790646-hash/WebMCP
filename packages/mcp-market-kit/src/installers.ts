import spawn from 'cross-spawn';
import * as path from 'path';
import * as fs from 'fs';

export class PythonInstaller {
  constructor(private rootDir: string) {}

  /**
   * Install a Python based MCP service into a sandbox directory.
   * This creates a dedicated virtual environment for the service.
   */
  async install(serviceId: string, pkgName: string, version: string = ''): Promise<boolean> {
    const serviceDir = path.join(this.rootDir, 'services', serviceId);
    const venvDir = path.join(serviceDir, 'venv');
    
    if (!fs.existsSync(serviceDir)) {
      fs.mkdirSync(serviceDir, { recursive: true });
    }

    console.log(`[PythonInstaller] Creating venv for ${serviceId} in ${venvDir}...`);

    // 1. Create venv
    await this.runCommand('python', ['-m', 'venv', 'venv'], serviceDir);

    // 2. Install package
    const pipPath = process.platform === 'win32' 
      ? path.join(venvDir, 'Scripts', 'pip.exe') 
      : path.join(venvDir, 'bin', 'pip');
    
    const installTarget = version ? `${pkgName}==${version}` : pkgName;
    console.log(`[PythonInstaller] Installing ${installTarget}...`);

    await this.runCommand(pipPath, ['install', installTarget], serviceDir);

    return true;
  }

  checkInstalled(serviceId: string): boolean {
    const serviceDir = path.join(this.rootDir, 'services', serviceId);
    const venvDir = path.join(serviceDir, 'venv');
    return fs.existsSync(venvDir);
  }

  private runCommand(command: string, args: string[], cwd: string): Promise<void> {
    return new Promise((resolve, reject) => {
      const child = spawn(command, args, {
        cwd,
        stdio: 'inherit',
        shell: true
      });

      child.on('close', (code) => {
        if (code === 0) resolve();
        else reject(new Error(`${command} failed with code ${code}`));
      });

      child.on('error', reject);
    });
  }
}

export class DockerInstaller {
  constructor() {}

  async install(serviceId: string, image: string): Promise<boolean> {
    console.log(`[DockerInstaller] Pulling image ${image} for ${serviceId}...`);
    
    return new Promise((resolve, reject) => {
      const child = spawn('docker', ['pull', image], {
        stdio: 'inherit',
        shell: true
      });

      child.on('close', (code) => {
        if (code === 0) {
          console.log(`[DockerInstaller] Successfully pulled ${image}`);
          resolve(true);
        } else {
          reject(new Error(`Docker pull failed with code ${code}`));
        }
      });

      child.on('error', reject);
    });
  }

  checkInstalled(_serviceId: string): boolean {
    // For docker, we could check if image exists, but pulling is usually fast if it exists
    // For now, let's just assume it's "installed" if we can pull it or if we don't want to check
    return true; 
  }
}
