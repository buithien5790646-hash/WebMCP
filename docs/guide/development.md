# 开发指南

如果你想参与 WebMCP 的开发，请阅读本指南。

## 获取代码

```bash
git clone https://github.com/three-water666/WebMCP.git
cd WebMCP
```

## 安装依赖

我们使用 `pnpm` 作为包管理工具：

```bash
pnpm install
```

## 开发命令

根目录提供了快捷命令来启动不同端的开发环境：

- **VSCode 插件**: `pnpm dev:vscode`
- **浏览器扩展**: `pnpm dev:browser`
- **桌面端**: `pnpm dev:desktop`
- **文档系统**: `pnpm docs:dev`

## 构建与发布

### 全量构建
运行以下命令进行全量类型检查和构建：
```bash
pnpm build
```

### 发布脚本
我们提供了跨平台的发布脚本：
- Linux/macOS: `./build_release.sh`
- Windows: `./build_release.ps1`

这些脚本会自动执行 Lint 检查、清理、构建并打包。

## 代码规范

- **Lint**: 使用 ESLint 进行代码规范检查。
- **Format**: 使用 Prettier 进行代码格式化。
- **Commit**: 提交信息请遵循 Conventional Commits 规范。
