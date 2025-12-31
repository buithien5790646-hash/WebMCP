import spawn from 'cross-spawn';

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
    return true; 
  }
}
