# ts-bootstrap Extension

A VS Code extension for simplifying JavaScript and TypeScript file execution and debugging.

[简体中文](./README.zh-CN.md)

## Features

- One-click run and debug for currently open JS/TS files
- Support for both debug mode and normal execution mode
- Support for selecting different Node.js versions for running or debugging files
- Automatic detection and prompting to install missing dependencies (e.g., ts-node)
- Configurable execution in current directory or file directory

## Usage

1. Open any JS or TS file
2. Click the run button or debug button (▶) in the editor's top-right corner
3. Alternatively, use the command palette to execute corresponding commands

## Configuration Options

- `ts-bootstrap.executeInCurrentDirectory`: Controls whether to execute code in the current working directory or in the file's directory

## Requirements

- ts-node installation required (for direct execution of TypeScript files)
- nvm recommended for Node.js version management