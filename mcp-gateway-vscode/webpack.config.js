//@ts-check

'use strict';

const path = require('path');

//@ts-check
/** @typedef {import('webpack').Configuration} WebpackConfig **/

/** @type WebpackConfig */
const extensionConfig = {
  target: 'node',
  mode: 'none',

  // 1. 修改入口：支持多文件打包
  entry: {
    extension: './src/extension.ts',
    commandServer: './src/servers/command.ts' // 👈 新增：独立 Command Server
  },
  output: {
    path: path.resolve(__dirname, 'dist'),
    filename: '[name].js', // 👈 修改：使用占位符，这样会生成 extension.js 和 commandServer.js
    libraryTarget: 'commonjs2'
  },
  externals: {
    vscode: 'commonjs vscode',
    // ⚠️ 关键：commandServer 运行在原生 Node 环境，不需要 'vscode' 模块，但 Webpack 可能会尝试打包 sdk 里的依赖。
    // 我们可以让它保留 require，或者让 webpack 帮我们打包 sdk。
    // 这里保持现状通常没问题，因为 target: node 会处理好大部分 native 模块。
  },
  resolve: {
    extensions: ['.ts', '.js']
  },
  module: {
    rules: [
      {
        test: /\.ts$/,
        exclude: /node_modules/,
        use: [
          {
            loader: 'ts-loader'
          }
        ]
      }
    ]
  },
  devtool: 'nosources-source-map',
  infrastructureLogging: {
    level: "log",
  },
};
module.exports = [ extensionConfig ];
