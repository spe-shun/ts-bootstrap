// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import * as vscode from 'vscode';
import runFile from './scripts/run-files';
import { checkTsNodeInstallation } from './scripts/check-tsnode';
import { selectNodeVersion } from './scripts/node-version';
import * as childProcess from 'child_process';

const DEBUG_TERMINAL_NAME = 'ts-node Debug Terminal';
const EXEC_TERMINAL_NAME = 'ts-node Terminal';

export function activate(context: vscode.ExtensionContext) {
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

    // 使用指定Node版本运行
    const execWithNodeVersionDisposable = vscode.commands.registerCommand(
        'extension.ts-bootstrap.execTerminalWithNodeVersion', 
        async () => {
            // 选择Node版本
            const nodeVersion = await selectNodeVersion();
            if (!nodeVersion) {
                return;
            }
            
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

            runFile(terminal, nodeVersion);
        }
    );

    // 使用指定Node版本调试
    const debugWithNodeVersionDisposable = vscode.commands.registerCommand(
        'extension.ts-bootstrap.debugTerminalWithNodeVersion', 
        async () => {
            // 选择Node版本
            const nodeVersion = await selectNodeVersion();
            if (!nodeVersion) {
                return;
            }
            
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

            runFile(terminal, nodeVersion);
        }
    );

    // 显示Node版本信息
    const showNodeVersionDisposable = vscode.commands.registerCommand(
        'extension.ts-bootstrap.showNodeVersion', 
        () => {
            try {
                const nodeVersion = childProcess.execSync('node --version', { encoding: 'utf8' }).trim();
                vscode.window.showInformationMessage(`当前Node.js版本: ${nodeVersion}`);
            } catch (error) {
                vscode.window.showErrorMessage('无法获取Node.js版本信息');
            }
        }
    );

    context.subscriptions.push(debugDisposable);
    context.subscriptions.push(execDisposable);
    context.subscriptions.push(execWithNodeVersionDisposable);
    context.subscriptions.push(debugWithNodeVersionDisposable);
    context.subscriptions.push(showNodeVersionDisposable);
}

// This method is called when your extension is deactivated
export function deactivate() {
    const terminals = [
        EXEC_TERMINAL_NAME,
        DEBUG_TERMINAL_NAME,
    ];
    
    terminals.forEach(name => {
        const terminal = vscode.window.terminals.find(t => t.name === name);
        if (terminal) {
            terminal.dispose();
        }
    });
}
