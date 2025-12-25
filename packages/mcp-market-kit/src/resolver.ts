import * as path from 'path';
import * as fs from 'fs';
import { ServiceConfig } from './types';

export class NodeResolver {
  constructor(private rootDir: string) {}

  /**
   * Resolve the execution config for an installed service.
   * It finds the entry point (bin/main) from the node_modules.
   */
  async resolve(serviceId: string, env: Record<string, string> = {}): Promise<ServiceConfig> {
    const serviceDir = path.join(this.rootDir, 'services', serviceId);
    
    // 1. Read the proxy package.json to find the actual package name
    const proxyPkgPath = path.join(serviceDir, 'package.json');
    if (!fs.existsSync(proxyPkgPath)) {
      throw new Error(`Service ${serviceId} is not installed (package.json not found in sandbox).`);
    }

    const proxyPkg = JSON.parse(fs.readFileSync(proxyPkgPath, 'utf-8'));
    const dependencies = proxyPkg.dependencies || {};
    const pkgName = Object.keys(dependencies)[0]; // We assume one dependency per service sandbox

    if (!pkgName) {
      throw new Error(`Service ${serviceId} seems broken (no dependencies in proxy package.json).`);
    }

    // 2. Locate the actual package's package.json in node_modules
    const pkgJsonPath = path.join(serviceDir, 'node_modules', pkgName, 'package.json');
    if (!fs.existsSync(pkgJsonPath)) {
      throw new Error(`Package ${pkgName} not found in node_modules. Did the installation fail?`);
    }

    const pkgJson = JSON.parse(fs.readFileSync(pkgJsonPath, 'utf-8'));

    // 3. Determine Entry Point
    // Priority: bin (first key) > main > index.js
    let entryRelative = '';

    if (pkgJson.bin) {
      if (typeof pkgJson.bin === 'string') {
        entryRelative = pkgJson.bin;
      } else if (typeof pkgJson.bin === 'object') {
        // Take the first binary defined
        entryRelative = Object.values(pkgJson.bin)[0] as string;
      }
    }

    if (!entryRelative && pkgJson.main) {
      entryRelative = pkgJson.main;
    }

    if (!entryRelative) {
      // Fallback check
      if (fs.existsSync(path.join(serviceDir, 'node_modules', pkgName, 'index.js'))) {
        entryRelative = 'index.js';
      } else {
        throw new Error(`Could not find entry point (bin/main) for ${pkgName}`);
      }
    }

    // 4. Construct Absolute Path
    const entryAbsolute = path.resolve(serviceDir, 'node_modules', pkgName, entryRelative);

    return {
      command: 'node',
      args: [entryAbsolute],
      env: { ...process.env, ...env }
    };
  }
}