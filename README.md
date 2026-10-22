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
- `ts-bootstrap.debugConsole`: Choose `internalConsole` (default) for Debug Console output, or `integratedTerminal` for programs that need interactive input or a TTY. This affects Debug only and supports per-folder settings.

## Requirements

- Node.js 18 or later
- `tsx` is required for direct TypeScript execution and can be installed from the extension prompt
- nvm recommended for Node.js version management

## Quick start

1. Open a saved `.js`, `.cjs`, `.mjs`, `.ts`, `.cts`, or `.mts` file.
2. Use the editor’s Run menu or Command Palette: **Run TS/JS** or **Debug TS/JS**. “With…” commands select an installed nvm / nvm-windows Node version.
3. Debug opens the Debug Console for stdout/stderr and names the session after the file. Use native VS Code breakpoints, variables, and stepping. Dirty files are saved before launch; a cancelled save cancels launch.

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

## Debug output and startup

Debug uses the Debug Console by default. It opens automatically and captures stdout/stderr without the long terminal environment command. VS Code may still display a single startup command line.

Output, including objects passed to `console.log`, is captured as text. Inspect expandable objects in Variables, Watch, or debug expressions.

The Debug Console cannot provide input to your program. For `readline`, stdin, prompts, or other TTY-dependent behavior, set the following in VS Code settings:

```json
{
    "ts-bootstrap.debugConsole": "integratedTerminal"
}
```

This choice is saved; the extension does not ask on each launch or try to detect whether a program needs input. Terminal mode keeps interactive input and may display VS Code’s debugger environment and startup command. Normal Run commands continue to use a terminal.

Debug now uses the standard VS Code JavaScript debugger launch path, with no forced entry pause or private CDP setup. It stops at your breakpoints and respects your exception-breakpoint settings. `--import` (or older Node’s `--loader`) loads tsx; VS Code may add its own inspector bootstrap options. Those are debugger/runtime options, not arguments passed to your script.

Only a necessary PATH override is added to the launch environment. Other variables are inherited normally rather than copied into the displayed command. If a real exception stops in loader/import internals, inspect the exception and Debug Console instead of blindly continuing; the extension does not suppress these stops.

## Development checks

`yarn test:unit` runs isolated regression tests with a mocked VS Code API, not end-to-end integration. `yarn test` runs the VS Code Electron integration suite and requires a supported desktop/display environment. Also run `yarn lint:check`, `yarn format:check`, and `yarn package` before packaging a VSIX.

`yarn test:debug` runs real debugger checks in a disposable VS Code profile and a workspace with spaces in its path. It uses an installed VS Code and a local tsx fixture (installing tsx in the temporary workspace if needed). Override their locations with `TS_BOOTSTRAP_E2E_VSCODE`, `TS_BOOTSTRAP_E2E_TSX`, and `TS_BOOTSTRAP_E2E_NODE`. Each run prints its diagnostics directory.

For normal Run commands, standalone files outside a workspace use a dedicated terminal with Node as the executable. Automatic tsx installation needs an open workspace folder; otherwise install tsx manually and retry.
