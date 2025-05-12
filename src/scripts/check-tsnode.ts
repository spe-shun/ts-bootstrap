import * as childProcess from 'child_process';
import * as vscode from 'vscode';

/**
 * 检查 ts-node 是否已安装，如果未安装则提示用户安装
 */
export function checkTsNodeInstallation(): boolean {
    let tsNodeInstalled = false;
    try {
        childProcess.execSync('which ts-node || where ts-node', { stdio: 'ignore' });
        tsNodeInstalled = true;
    } catch (error) {
        // ts-node 未安装，提示用户安装
        const installButton = 'Install ts-node';
        vscode.window.showErrorMessage(
            'ts-bootstrap extension depends on ts-node. Please install it to run TypeScript files directly.',
            installButton
        ).then(selection => {
            if (selection === installButton) {
                const terminal = vscode.window.createTerminal('ts-node Installation');
                terminal.show();
                terminal.sendText('npm install -g ts-node');
                terminal.sendText('echo "Installation completed. Please restart VS Code after installation."');
            }
        });
    }
    return tsNodeInstalled;
} 