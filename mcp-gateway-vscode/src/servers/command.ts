import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';
import { exec } from 'child_process';
import * as path from 'path';

// --- 安全配置 ---
const ALLOWED_COMMANDS = new Set([
  // 包管理器
  'npm', 'pnpm', 'yarn', 'bun',
  // 运行时 & 编译器
  'node', 'deno', 'ts-node', 'python', 'python3', 'go', 'cargo', 'java', 'javac', 'dotnet', 'gcc', 'g++',
  // 构建工具
  'npx', 'vite', 'webpack', 'rollup', 'esbuild', 'parcel', 'make', 'cmake', 'gradle', 'mvn',
  // 版本控制
  'git', 'svn',
  // 常用工具
  'ls', 'dir', 'echo', 'cat', 'type', 'mkdir', 'touch', 'grep', 'pwd', 'whoami', 'test',
  // 代码质量
  'eslint', 'prettier', 'tsc'
]);

// 危险字符/模式黑名单
const DANGEROUS_PATTERNS = [
  'rm ', 'rmdir', 'del ', // 删除
  'mv ', 'move ', // 移动 (可能覆盖文件)
  '>', '>>', // 重定向 (可能覆盖文件)
  'sudo', 'su ', // 提权
  'chmod', 'chown', // 权限修改
  'shutdown', 'reboot', // 系统操作
  'wget', 'curl', // 下载 (可能下载恶意脚本)
  '| sh', '| bash', '| zsh', '| cmd', '| powershell', // 管道执行
  ':(){ :|:& };:', // Fork Bomb
];

function isSubPath(parent: string, child: string): boolean {
  const relative = path.relative(parent, child);
  return relative === '' || (!relative.startsWith('..') && !path.isAbsolute(relative));
}

function validateCommand(command: string): { valid: boolean; reason?: string } {
  const trimmed = command.trim();
  if (!trimmed) return { valid: false, reason: "Empty command" };

  // 1. 检查危险模式
  for (const pattern of DANGEROUS_PATTERNS) {
    if (trimmed.includes(pattern)) {
      return { valid: false, reason: `Blocked dangerous pattern: "${pattern}"` };
    }
  }

  // 2. 检查命令白名单 (检查第一个单词)
  // 处理 'npm run test' 或 'git status' 等情况
  // 简单分割，取第一个 token
  const firstToken = trimmed.split(/\s+/)[0];
  const baseCommand = path.basename(firstToken).replace(/\.(exe|cmd|bat|sh)$/i, ''); // 移除扩展名

  if (!ALLOWED_COMMANDS.has(baseCommand)) {
    return { valid: false, reason: `Command "${baseCommand}" is not in the allowed whitelist.` };
  }

  return { valid: true };
}

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
    description: 'Execute a shell command in the background. Use this for short-lived commands where you need to analyze the output (e.g., "ls", "git status"). For long-running processes (e.g., "npm start") or when user visibility is required, use "run_in_terminal" instead. SECURITY RESTRICTION: Commands are strictly limited to the current workspace directory. Accessing files outside the workspace is forbidden.',
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

      // 🔒 安全检查：使用 path.relative 进行严格检查
      if (!isSubPath(projectRoot, resolvedCwd)) {
        return {
          content: [
            { type: 'text', text: `❌ Permission Denied: Access to '${cwd}' is forbidden. Path must be within workspace: ${projectRoot}` },
          ],
          isError: true,
        };
      }
      targetCwd = resolvedCwd;
    }

    // 2. 命令安全检查
    const validation = validateCommand(command);
    if (!validation.valid) {
      return {
        content: [
          { type: 'text', text: `❌ Security Error: ${validation.reason}\nAllowed commands: ${Array.from(ALLOWED_COMMANDS).join(', ')}` },
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

