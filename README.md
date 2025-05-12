# ts-bootstrap 扩展

一个用于简化 JavaScript 和 TypeScript 文件运行和调试的 VS Code 扩展。

## 功能特性

- 支持一键运行和调试当前打开的 JS/TS 文件
- 提供调试模式和普通运行模式
- 支持选择不同 Node.js 版本运行或调试文件
- 自动检测并提示安装缺少的依赖（如 ts-node）
- 可配置在当前目录或文件所在目录执行代码

## 使用方法

1. 打开任意 JS 或 TS 文件
2. 点击编辑器右上角的运行按钮（▶）或调试按钮（⬤）
3. 也可以使用命令面板执行相应命令

## 配置选项

- `ts-bootstrap.executeInCurrentDirectory`：控制在当前工作目录还是文件所在目录执行代码

## 要求

- 需要安装 ts-node（用于直接运行 TypeScript 文件）
- 推荐使用 nvm 进行 Node.js 版本管理