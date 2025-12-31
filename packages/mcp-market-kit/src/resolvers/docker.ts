import { ServiceConfig } from '../types';

export class DockerResolver {
  constructor() {}

  async resolve(_serviceId: string, image: string, env: Record<string, string> = {}): Promise<ServiceConfig> {
    const args = ['run', '--rm', '-i'];
    
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
