import spawn from 'cross-spawn';
import * as path from 'path';
import * as fs from 'fs';

export class PythonInstaller {
  constructor(private rootDir: string) {}

  /**
   * Get available python command
   */
  private async getPythonCommand(): Promise<string> {
    const commands = ['python', 'python3', 'py'];
    for (const cmd of commands) {
      try {
        await new Promise((resolve, reject) => {
          const child = spawn(cmd, ['--version'], { 
            shell: true,
            stdio: ['ignore', 'ignore', 'ignore'] 
          });
          child.on('close', (code) => code === 0 ? resolve(true) : reject());
          child.on('error', reject);
        });
        return cmd;
      } catch (e) {
        continue;
      }
    }
    throw new Error('Python not found. Please install Python and add it to your PATH.');
  }

  /**
   * Install a Python based MCP service into a sandbox directory.
   * This creates a dedicated virtual environment for the service.
   */
  async install(serviceId: string, pkgName: string, version: string = ''): Promise<boolean> {
    const pythonCmd = await this.getPythonCommand();
    const serviceDir = path.join(this.rootDir, 'services', serviceId);
    const venvDir = path.join(serviceDir, 'venv');
    
    if (!fs.existsSync(serviceDir)) {
      fs.mkdirSync(serviceDir, { recursive: true });
    }

    console.log(`[PythonInstaller] Creating venv for ${serviceId} using ${pythonCmd} in ${venvDir}...`);

    // 1. Create venv
    await this.runCommand(pythonCmd, ['-m', 'venv', 'venv'], serviceDir);

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
        stdio: ['ignore', 'inherit', 'inherit'], // Avoid handle invalid error on Windows
        shell: true
      });

      child.on('close', (code) => {
        if (code === 0) resolve();
        else reject(new Error(`${command} failed with code ${code}`));
      });

      child.on('error', (err) => {
        console.error(`[PythonInstaller] Spawn error for ${command}:`, err);
        reject(err);
      });
    });
  }
}
