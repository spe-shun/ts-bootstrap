// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import * as vscode from 'vscode';
import runFile from './scripts/run-files';
import { checkTsNodeInstallation } from './scripts/check-tsnode';
import { setupNodeVersionStatusBar } from './scripts/node-version';

const DEBUG_TERMINAL_NAME = 'ts-node Debug Terminal';
const EXEC_TERMINAL_NAME = 'ts-node Terminal';

export function activate(context: vscode.ExtensionContext) {
    // 设置状态栏显示 Node.js 版本
    setupNodeVersionStatusBar(context);

    // 检查 ts-node 是否已安装
    checkTsNodeInstallation();

    const debugDisposable = vscode.commands.registerCommand('extension.ts-bootstrap.debugTerminal', async () => {
        vscode.window.terminals.forEach(t => {
            if (t.name === DEBUG_TERMINAL_NAME) {
                t.dispose();
            }
        });

        await vscode.commands.executeCommand('extension.js-debug.createDebuggerTerminal', '', undefined, {
            name: DEBUG_TERMINAL_NAME,
        });

        const terminal = vscode.window.terminals.find(t => t.name === DEBUG_TERMINAL_NAME);

        if (!terminal) {
            vscode.window.showInformationMessage('Unable to create JavaScript Debug Terminal.');
            return;
        }

        if (vscode.debug.activeDebugSession) {
            vscode.window.showInformationMessage(
                'There is an ongoing Debug session running. Please close it and retry.',
            );
            return;
        }

        runFile(terminal);
    });

    const execDisposable = vscode.commands.registerCommand('extension.ts-bootstrap.execTerminal', () => {
        vscode.window.terminals.forEach(t => {
            if (t.name === EXEC_TERMINAL_NAME) {
                t.dispose();
            }
        });

        const terminal = vscode.window.createTerminal({ name: EXEC_TERMINAL_NAME });

        if (!terminal) {
            vscode.window.showInformationMessage('Unable to create Terminal.');
            return;
        }

        runFile(terminal);
    });

    context.subscriptions.push(debugDisposable);
    context.subscriptions.push(execDisposable);
}

// This method is called when your extension is deactivated
export function deactivate() {
    const terminal = vscode.window.terminals.find(t => t.name === EXEC_TERMINAL_NAME);

    if (terminal) {
        terminal.dispose();
    }
}
