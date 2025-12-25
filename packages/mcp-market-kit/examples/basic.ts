import { MCPManager } from '../src';
import * as path from 'path';
import * as fs from 'fs';

(async () => {
  // 1. 初始化 Manager (数据存放在 ./temp-mcp-data 目录下，方便清理)
  const testRootDir = path.join(__dirname, 'temp-mcp-data');
  const manager = new MCPManager({
    rootDir: testRootDir
  });

  console.log('--- 🚀 Starting MCP Market Kit Demo ---');
  console.log(`📂 Storage Path: ${testRootDir}`);

  // 2. 定义我们要安装的服务 
  // 这里以 filesystem 为例，因为它是官方维护且最标准的
  const fsService = {
    id: 'filesystem',
    name: 'Local Filesystem',
    type: 'node' as const,
    metadata: {
      npmPackage: '@modelcontextprotocol/server-filesystem'
    }
  };

  // 3. 执行安装
  console.log(`\n📦 Installing ${fsService.name} (${fsService.metadata.npmPackage})...`);
  try {
    await manager.install(fsService);
    console.log('✅ Installation Completed!');
  } catch (err) {
    console.error('❌ Installation Failed:', err);
    process.exit(1);
  }

  // 4. 解析启动路径
  console.log(`\n🔍 Resolving entry point...`);
  try {
    const config = await manager.resolve('filesystem', {
      TEST_ENV: 'hello'
    });

    console.log('🎉 Resolved Config:');
    console.log(JSON.stringify(config, null, 2));

    // 5. 简单的验证
    if (fs.existsSync(config.args[0])) {
        console.log(`\n✅ VERIFIED: Entry file exists at \n   ${config.args[0]}`);
    } else {
        console.error(`\n❌ ERROR: Entry file does not exist!`);
    }

  } catch (err) {
    console.error('❌ Resolution Failed:', err);
  }
})();