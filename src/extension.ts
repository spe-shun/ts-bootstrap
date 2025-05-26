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
    // Check if ts-node is installed
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
            vscode.window.showInformationMessage(vscode.l10n.t('terminal.unableToCreateDebugTerminal'));
            return;
        }

        if (vscode.debug.activeDebugSession) {
            vscode.window.showInformationMessage(vscode.l10n.t('terminal.debugSessionRunning'));
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
            vscode.window.showInformationMessage(vscode.l10n.t('terminal.unableToCreateTerminal'));
            return;
        }

        runFile(terminal);
    });

    // Run with specified Node version
    const execWithNodeVersionDisposable = vscode.commands.registerCommand(
        'extension.ts-bootstrap.execTerminalWithNodeVersion',
        async () => {
            // Select Node version
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
                vscode.window.showInformationMessage(vscode.l10n.t('terminal.unableToCreateTerminal'));
                return;
            }

            runFile(terminal, nodeVersion);
        },
    );

    // Debug with specified Node version
    const debugWithNodeVersionDisposable = vscode.commands.registerCommand(
        'extension.ts-bootstrap.debugTerminalWithNodeVersion',
        async () => {
            // Select Node version
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
                vscode.window.showInformationMessage(vscode.l10n.t('terminal.unableToCreateDebugTerminal'));
                return;
            }

            if (vscode.debug.activeDebugSession) {
                vscode.window.showInformationMessage(vscode.l10n.t('terminal.debugSessionRunning'));
                return;
            }

            runFile(terminal, nodeVersion);
        },
    );

    context.subscriptions.push(debugDisposable);
    context.subscriptions.push(execDisposable);
    context.subscriptions.push(execWithNodeVersionDisposable);
    context.subscriptions.push(debugWithNodeVersionDisposable);
}

// This method is called when your extension is deactivated
export function deactivate() {
    const terminals = [EXEC_TERMINAL_NAME, DEBUG_TERMINAL_NAME];

    terminals.forEach(name => {
        const terminal = vscode.window.terminals.find(t => t.name === name);
        if (terminal) {
            terminal.dispose();
        }
    });
}
