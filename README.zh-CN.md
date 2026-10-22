# ts-bootstrap 扩展

一个用于简化 JavaScript 和 TypeScript 文件运行和调试的 VS Code 扩展。

[English](./README.md)

## 功能特性

- 支持一键运行和调试当前打开的 JS/TS 文件
- 提供调试模式和普通运行模式
- 支持选择不同 Node.js 版本运行或调试文件
- 自动检测并提示安装 TypeScript 运行器（`tsx`）
- 可配置在工作区文件夹或文件所在目录执行代码

## 使用方法

1. 打开任意 JS 或 TS 文件
2. 点击编辑器右上角的运行或调试按钮（▶）
3. 也可以使用命令面板执行相应命令

## 配置选项

- `ts-bootstrap.executeInCurrentDirectory`：选择目标文件所属工作区（true）或文件所在目录（false），不是终端当前目录

## 要求

- Node.js 18 或更高版本
- 直接运行 TypeScript 文件需要 `tsx`，可通过扩展提示自动安装
- 推荐使用 nvm 进行 Node.js 版本管理

## 快速使用

1. 打开已保存的 `.js`、`.cjs`、`.mjs`、`.ts`、`.cts` 或 `.mts` 文件。
2. 在编辑器运行菜单或命令面板选择“运行 TS/JS”或“调试 TS/JS”；带“选择 Node.js”的命令可选择 nvm / nvm-windows 已安装的版本。
3. 调试使用 VS Code 原生断点、变量和单步面板。运行前会保存修改；取消保存也会取消运行。

不支持 `.jsx`、`.tsx`、浏览器应用、打包构建或任意项目脚本。本插件用于单文件 Node.js 运行，不替代项目自己的 launch 配置。

## 运行环境与任务

运行和调试使用同一个绝对 Node.js 路径、tsx loader、工作目录和环境。默认从 VS Code 扩展宿主的 PATH 查找 Node.js，也可选择 nvm 版本；选定 Node 目录会放在 PATH 最前。运行采用进程任务，不拼接 shell 命令，也不读取终端启动脚本。如果 Node 仅在 shell 配置中可见，请从包含 Node PATH 的环境启动 VS Code，或使用版本选择命令；修改环境后重启 VS Code。

TypeScript 需要 Node.js 18+ 和 tsx。优先查找目标文件向上最近的 `node_modules/tsx`，再查找所选 Node 环境和 PATH 中的全局安装。仅缺失时询问是否安装全局 tsx，不会自动修改项目依赖。找不到 Node 对应的 npm 时，可在项目或选定 Node 环境中手动安装 tsx 后重试。

不同文件各自保留运行任务；重跑同一文件时只停止该文件上一次由插件创建的任务，不会关闭其他文件或同名终端。可通过 VS Code 的“终止任务”停止运行，也不必先关闭无关调试会话。

## 工作目录设置

为保持兼容，保留 `ts-bootstrap.executeInCurrentDirectory`：
- `true`（默认）：目标文件所属的工作区文件夹。
- `false`：目标文件所在目录。
- 文件位于工作区外：始终使用文件所在目录。

多根工作区可按文件夹分别设置。这里的“CurrentDirectory”不是终端当前目录。运行任务显示解析后的执行命令，调试使用相同解析结果。

## 开发验证

`yarn test:unit` 通过模拟 VS Code API 执行独立回归测试，不代表端到端测试。`yarn test` 是 VS Code Electron 集成测试，需要可用桌面/显示环境。打包前还应执行 `yarn lint:check`、`yarn format:check` 和 `yarn package`。

工作区外的独立文件使用以 Node 为可执行程序的专用终端。自动安装 tsx 需要打开工作区文件夹；否则请手动安装 tsx 后重试。

### 调试启动

调试使用 VS Code JavaScript 调试器的标准启动流程，不强制在入口暂停，也不再通过私有 CDP 流程拦截暂停。你的断点和异常断点设置仍然生效。`--import`（旧版 Node 使用 `--loader`）用于加载 tsx；VS Code 可能添加自己的调试启动参数。这些属于运行时/调试器参数，不是传给脚本的业务入参。

启动环境只覆盖必要的 PATH，其余变量正常继承，不再整份复制到终端命令。若真实导入错误或异常停在内部加载器，请查看异常和调试控制台；插件不会无差别跳过这些暂停。
