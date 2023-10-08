// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import * as childProcess from 'child_process';
import * as path from 'path';
import * as vscode from 'vscode';

// TODO 
/**
 * 1 如何启动 DEBUG mode
 * 2 兼容其他情况，增加健壮性
 * 3 提供更多的运行模式，option 配置可用
 */

const TERMINAL_NAME = 'ts-node Terminal';
// This method is called when your extension is activated
// Your extension is activated the very first time the command is executed
export function activate(context: vscode.ExtensionContext) {
    let disposable = vscode.commands.registerCommand('ts-bootstrap.runAtTsNodeTerminal', () => {
        // 找之前有没有启动过 该 Terminal
        let terminal = vscode.window.terminals.find(t => t.name === TERMINAL_NAME);

        if (!terminal) {
            terminal = vscode.window.createTerminal({ name: TERMINAL_NAME });
        }

        const tsVilidResult = childProcess.execSync('which ts-node').toString();

        if (/ts-node\snot\sfound/.test(tsVilidResult)) {
            vscode.window.showInformationMessage('请先运行 npm i -g ts-node');
            return;
        }

        const activeTextEditor = vscode.window.activeTextEditor;

        if (activeTextEditor) {
            const baseName = activeTextEditor.document.fileName;

            const pathName = path.dirname(baseName);
            const fileName = path.basename(baseName);

            terminal.show();
            terminal.sendText(`cd ${pathName} && ts-node ${fileName}`);
        } else {
            vscode.window.showInformationMessage('未选中任何文件');
        }

        // 在终端中执行命令

        // // 显示终端
        // terminal.show();
        // // 获取当前活动的调试会话;
        // const activeDebugSession = vscode.debug.activeDebugSession;

        // if (activeDebugSession) {
        //     // 发送自定义命令给 JavaScript 调试会话
        //     activeDebugSession
        //         .customRequest('yourCustomRequestName')
        //         .then(response => {
        //             // 处理响应
        //             vscode.window.showInformationMessage(
        //                 'Received response from JavaScript Debug Session: ' + JSON.stringify(response),
        //             );
        //         })
        //         // .catch(error => {
        //         //     // 处理错误
        //         //     vscode.window.showErrorMessage(
        //         //         'Error communicating with JavaScript Debug Session: ' + error.message,
        //         //     );
        //         // });
        // } else {
        //     vscode.window.showInformationMessage('No active JavaScript Debug Session found.');
        // }
        // // 配置要启动的调试器
        // const debugConfiguration = {
        //     type: 'node',
        //     request: 'attach',
        //     name: 'Attach to Process',
        //     port: 9229, // 连接到的进程的调试端口
        // };

        // // 启动调试 Attach 模式
        // vscode.debug.startDebugging(undefined, debugConfiguration);
    });

    context.subscriptions.push(disposable);
}

// This method is called when your extension is deactivated
export function deactivate() {}
