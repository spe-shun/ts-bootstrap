# ts-bootstrap Extension

A VS Code extension for simplifying JavaScript and TypeScript file execution and debugging.

[简体中文](./README.zh-CN.md)

## Features

- One-click run and debug for currently open JS/TS files
- Support for both debug mode and normal execution mode
- Support for selecting different Node.js versions for running or debugging files
- Automatic detection and prompting to install the TypeScript runtime (`tsx`)
- Configurable execution in workspace folder or file directory

## Usage

1. Open any JS or TS file
2. Click the run button or debug button (▶) in the editor's top-right corner
3. Alternatively, use the command palette to execute corresponding commands

## Configuration Options

- `ts-bootstrap.executeInCurrentDirectory`: Use the target workspace folder (true) or the file’s directory (false), not the terminal current directory

## Requirements

- Node.js 18 or later
- `tsx` is required for direct TypeScript execution and can be installed from the extension prompt
- nvm recommended for Node.js version management

## Quick start

1. Open a saved `.js`, `.cjs`, `.mjs`, `.ts`, `.cts`, or `.mts` file.
2. Use the editor’s Run menu or Command Palette: **Run TS/JS** or **Debug TS/JS**. “With…” commands select an installed nvm / nvm-windows Node version.
3. Debug uses the native VS Code breakpoints, variables, and stepping UI. Dirty files are saved before launch; a cancelled save cancels launch.

JSX / TSX (`.jsx`, `.tsx`), browser applications, bundling, and arbitrary project scripts are not supported. This is a single-file Node.js runner, not a replacement for project launch configurations.

## Runtime and terminal behavior

Run and Debug resolve the same absolute Node.js executable from the VS Code extension host’s PATH, or the selected nvm version. They use the same working directory and inherited environment, with the selected Node directory prepended to PATH. Run uses a process task: no shell command concatenation or shell startup scripts. If Node exists only in your shell configuration, start VS Code with Node on PATH or use the version-selection command, then restart VS Code after environment changes.

TypeScript requires Node.js 18+ and tsx. Resolution prefers the nearest `node_modules/tsx` above the target file, then the selected Node installation, then visible PATH installations. A global installation is offered only when needed and requires confirmation; your project dependencies are never changed automatically. If automatic installation cannot locate npm beside Node, install tsx manually in the project or selected Node environment and retry.

Each file has its own extension-owned task. Running another file leaves existing runs alive; rerunning the same file stops its previous task before starting again. VS Code’s Stop Task controls remain available. Closing an unrelated terminal or an unrelated debugger is never required.

## Working directory

`ts-bootstrap.executeInCurrentDirectory` is retained for compatibility:
- `true` (default): the workspace folder containing the target file.
- `false`: the target file’s directory.
- Outside a workspace: always the file’s directory.

The setting supports per-folder values in multi-root workspaces. It does **not** mean the terminal’s current directory. Run’s task command shows the resolved runtime; Debug’s launch configuration uses the same resolution.

## Development checks

`yarn test:unit` runs isolated regression tests with a mocked VS Code API, not end-to-end integration. `yarn test` runs the VS Code Electron integration suite and requires a supported desktop/display environment. Also run `yarn lint:check`, `yarn format:check`, and `yarn package` before packaging a VSIX.

Standalone files outside a workspace run in a dedicated terminal with Node as the executable. Automatic tsx installation needs an open workspace folder; otherwise install tsx manually and retry.
