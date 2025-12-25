export interface MCPService {
  id: string;          // 唯一标识 (e.g. "@modelcontextprotocol/server-filesystem")
  name: string;
  description?: string;
  type: 'node' | 'python'; 
  metadata: {
    npmPackage?: string;
    pythonPackage?: string;
    version?: string;
  };
}

export interface ServiceConfig {
  command: string;     // 最终执行命令 (node/python)
  args: string[];      // 参数 (绝对路径入口)
  env?: Record<string, string>;
}

export interface MCPOptions {
  rootDir: string;     // SDK 管理数据的根目录
  registryUrl?: string;
}

export interface InstallResult {
  success: boolean;
  path: string;
  version?: string;
}