// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import * as childProcess from 'child_process';
import * as path from 'path';
import * as vscode from 'vscode';

/**
 * // TODO 兼容其他情况，增加健壮性
 * // TODO 提供更多的运行模式，option 配置可用
 */
const DEBUG_TERMINAL_NAME = 'JavaScript Debug Terminal';
const EXEC_TERMINAL_NAME = 'ts-node Terminal';

export function activate(context: vscode.ExtensionContext) {
    const tsVilidResult = childProcess.execSync('which ts-node').toString();

    if (/ts-node\snot\sfound/.test(tsVilidResult)) {
        vscode.window.showInformationMessage(
            'ts-bootstrap extension depends on the global installation of ts-node. Please run "npm i -g ts-node" first and then try again.',
        );
    }

    const runFile = (terminal: vscode.Terminal) => {
        const activeTextEditor = vscode.window.activeTextEditor;

        if (activeTextEditor) {
            const baseName = activeTextEditor.document.fileName;

            const pathName = path.dirname(baseName);
            const fileName = path.basename(baseName);

            terminal.show();
            terminal.sendText(`cd ${pathName} && ts-node ${fileName}`);
        } else {
            vscode.window.showInformationMessage('No files selected.');
        }
    };

    const debugDisposable = vscode.commands.registerCommand('extension.ts-bootstrap.debugTerminal', async () => {
        let terminal = vscode.window.terminals.find(t => t.name === DEBUG_TERMINAL_NAME);

        if (!terminal) {
            await vscode.commands.executeCommand('extension.js-debug.createDebuggerTerminal');
            terminal = vscode.window.terminals.find(t => t.name === DEBUG_TERMINAL_NAME);
        }

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
        let terminal = vscode.window.terminals.find(t => t.name === EXEC_TERMINAL_NAME);

        if (!terminal) {
            terminal = vscode.window.createTerminal({ name: EXEC_TERMINAL_NAME });
        }

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
