# Changelog

All notable changes to this project will be documented in this file.

## v0.5.2 (2025-12-14)
### ✨ Features
- **Bridge**: 添加设置快捷按钮，并优化平台检测逻辑。
- **Core**: 实现工具分组 (Tool Grouping) 显示与初始化逻辑优化。

### 🐛 Bug Fixes
- **Bridge**: 增强 JSON 解析的健壮性，修复非标准空格 (non-breaking spaces) 导致的报错。
- **Bridge**: 修复 Popup 中用户规则 (User Rules) 的存储 Key 错误。
- **Bridge**: 修复从 Popup 复制 System Prompt 时未包含用户规则的问题。
- **Bridge**: 修复 Content Script 结果处理中的竞态条件 (Race Condition)。

---

## v0.5.1 (2025-12-13)
### ✨ Features
- **VSCode**: 新增编辑器右键菜单 "WebMCP: Copy Context"，一键复制文件路径和选中代码。

---

## v0.5.0 (2025-12-12)
**Major Update**: 架构重构与核心功能增强。

### ✨ Features
- **Architecture**: 浏览器插件重构为 Vite + TypeScript Monorepo 结构。
- **Performance**: 实现工具分层懒加载 (Tiered Tool Discovery)，大幅降低 Token 消耗。
- **Sync**: 实现基于 Host 的配置云同步功能 (Host-based Config Sync)。
- **Options**: 新增用户规则 (User Rules) 配置，支持自定义个性化指令。
- **Adapters**: 新增对 AI Studio 的支持，更新页面选择器。

### 🐛 Bug Fixes
- **Bridge**: 修复自动发送的竞态条件死锁问题。
- **Bridge**: 修复发送 Bug 及设置页配置持久化问题。

---

## v0.4.6 (2025-12-12)
### ✨ Features
- **Gateway**: 正式发布 `run_in_terminal` 工具，支持在前台终端执行交互式命令。

---

## v0.4.5 (2025-12-11)
### ✨ Features
- **Core**: 实现服务器闲置 30 分钟自动超时 (Timeout) 机制。
- **Core**: 实现 Session Token 持久化，重启插件无需重新连接。

---

## v0.4.4 (2025-12-11)
### ✨ Features
- **UX**: 升级工具调用状态的可视化反馈。
- **Protocol**: 引入 `purpose` 协议字段，增强操作意图说明。
- **Config**: 支持配置的导入与导出功能。

---

## v0.4.1 (2025-12-11)
### ✨ Features
- **Config**: 翻转服务器加载逻辑，由 `enabled` 改为 `disabled` (默认启用)。
- **Security**: 添加命令执行的安全验证机制。

---

## v0.4.0 (2025-12-11)
### ✨ Features
- **Command**: 集成 `mcp-server-command`，支持后台命令执行。

### 🛡️ HITL & UX Polish
- **Security**: 修复 HITL 弹窗的 XSS 漏洞及超长参数显示问题。
- **UX**: 移除原生 Alert，改为卡片内视图切换 (Inline View Transition)。
- **I18n**: HITL 审批弹窗全面支持本地化。
- **UX**: 设置页增加底部悬浮保存栏 (Sticky Save Footer)。
- **Fix**: 修复 Gateway 对远程工具 (GitHub) 相对路径解析错误的问题。

---

## v0.3.2 (2025-12-10)
### ✨ Features
- **Transport**: 完善 HTTP/SSE 传输支持，最大化向后兼容性。

---

## v0.3.0 (2025-12-10)
**Major Update**: 人工介入审批系统 (HITL)。

### ✨ Features
- **HITL**: 实现工具调用审批系统 (Human-in-the-Loop)。
- **Security**: 实现自动防御 (Auto-Protect) 逻辑，新工具默认加入保护名单。
- **UX**: 支持 "Always Allow" (永久允许) 选项。

### 🐛 Bug Fixes
- **Bridge**: 移除 `tabs` 权限以符合商店合规要求。
- **Bridge**: 优化批处理队列，修复死锁风险。

---

## v0.2.0 (2025-12-10)
### ✨ Features
- **Core**: 引入请求队列 (Request Queue)，确保并发工具调用的结果顺序回填。
- **Logging**: 增加队列日志可视化。
- **Control**: 支持手动控制本地服务的启停。

---

## v0.1.7 (2025-12-09)
### ✨ Features
- **Bridge**: 优化通知流程，增强 JSON 容错能力。
- **UX**: 浏览器插件增加未成功发送的系统提示，VS Code 插件增加 "Starting" 状态显示。

---

## v0.1.5 (2025-12-09)
### ✨ Features
- **Architecture**: 针对 Multi-Host 和 Popup 逻辑进行全面更新。

---

## v0.1.4 (2025-12-08)
### ✨ Features
- **Config**: 重构浏览器配置为“以站点为中心 (Site-centric)”的模型。
- **I18n**: 支持可配置的选择器和多语言 Prompt。

---

## v0.1.3 (2025-12-07)
### ✨ Features
- **Dev**: 添加调试功能与实现说明。
- **Log**: 统一日志格式，添加状态指示。

---

## v0.1.2 (2025-12-07)
### ✨ Features
- **UX**: 优化输入处理逻辑，标准化换行符。
- **UX**: 简化复制按钮文本。

---

## v0.1.1 (2025-12-05)
**Initial Release**: Zero-Config Support.

### ✨ Features
- **Gateway**: 核心功能初始化，支持 Zero-Config 连接。
- **Bridge**: 支持动态端口配置与浏览器选择。
- **Docs**: 添加中英文文档与项目交接文档。
