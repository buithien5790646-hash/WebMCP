#!/usr/bin/env node

import { startGateway, PORT, CONFIG_FILE } from './server.js';

/**
 * 这是脚手架 (CLI) 的入口点。
 * 它负责启动核心网关服务。
 * 未来可以在这里添加命令行参数解析逻辑，例如 --port 或 --config
 */

console.log(`
--------------------------------------------
🚀 MCP2API Local Gateway (CLI Mode) 启动中...
   -> 配置文件: ${CONFIG_FILE}
   -> 默认端口: ${PORT}
--------------------------------------------
`);

startGateway().catch(err => {
    console.error('❌ 网关启动失败:', err.message);
    process.exit(1);
});
