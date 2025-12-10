import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';
import { exec } from 'child_process';
import * as path from 'path';

// --- 命令行参数解析 --- 

function getProjectRoot() {
  const args = process.argv;
  const rootIndex = args.indexOf('--project-root');
  if (rootIndex !== -1 && args.length > rootIndex + 1) {
    return args[rootIndex + 1];
  }
  return null;
}

const projectRoot = getProjectRoot();

// --- MCP Server 核心逻辑 --- 

// 创建 MCP 服务器
const server = new McpServer({
  name: 'mcp-server-command',
  version: '1.0.0',
});

// 注册工具
server.registerTool(
  'execute_command',
  {
    description: 'Execute a shell command. SECURITY RESTRICTION: Commands are strictly limited to the current workspace directory. Accessing files outside the workspace is forbidden.',
    inputSchema: {
      command: z.string().describe('The command to execute (e.g., "npm test", "ls -la")'),
      cwd: z.string().optional().describe('Optional: Current working directory. Must be within the workspace. Defaults to workspace root.'),
      timeout: z.number().default(60000).describe('Optional: Timeout in milliseconds (default: 60s).'),
    },
  },
  async ({ command, cwd, timeout }) => {
    // 0. 获取工作区根目录
    if (!projectRoot) {
      return {
        content: [
          { type: 'text', text: `❌ Security Error: Project root not configured. Command execution is disabled for safety.` },
        ],
        isError: true,
      };
    }

    // 1. 路径安全解析 (Path Sanitization)
    // 如果不传 cwd，默认为项目根目录 (projectRoot)
    let targetCwd = projectRoot;

    if (cwd) {
      // 解析绝对路径：如果是相对路径，则相对于 projectRoot 解析
      const resolvedCwd = path.isAbsolute(cwd) 
        ? path.normalize(cwd) 
        : path.resolve(projectRoot, cwd);

      // 🔒 安全检查：必须以 projectRoot 开头
      if (!resolvedCwd.startsWith(projectRoot)) {
        return {
          content: [
            { type: 'text', text: `❌ Permission Denied: Access to '${cwd}' is forbidden. You can only execute commands within the workspace: ${projectRoot}` },
          ],
          isError: true,
        };
      }
      targetCwd = resolvedCwd;
    }

    // 2. 命令安全检查 (基础黑名单)
    const dangerous = ['rm -rf /', ':(){ :|:& };:', '> /dev/sda'];
    if (dangerous.some(d => command.includes(d))) {
      return {
        content: [
          { type: 'text', text: `❌ Error: Command contains dangerous patterns blocked by safety policy.` },
        ],
        isError: true,
      };
    }

    try {
      // 3. 执行命令
      const result = await new Promise<{ stdout: string; stderr: string }>((resolve, reject) => {
        exec(command, {
          cwd: targetCwd, // 使用经过验证的安全路径
          timeout: timeout,
          maxBuffer: 1024 * 1024 * 10, // 10MB buffer
        }, (error, stdout, stderr) => {
          if (error) {
            resolve({ 
              stdout: stdout || '', 
              stderr: stderr || error.message 
            });
          } else {
            resolve({ stdout, stderr });
          }
        });
      });

      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify({
              stdout: result.stdout.trim(),
              stderr: result.stderr.trim(),
              status: result.stderr ? 'completed_with_stderr' : 'success'
            }, null, 2)
          }
        ],
        isError: false,
      };
    } catch (error: any) {
      return {
        content: [
          { type: 'text', text: `❌ Execution System Error: ${error.message}` },
        ],
        isError: true,
      };
    }
  }
);

// 启动服务器
const transport = new StdioServerTransport();
server.connect(transport).catch((error) => {
  console.error('Server failed to start:', error);
  process.exit(1);
});
