import * as childProcess from 'child_process';
import * as vscode from 'vscode';
import { isWindows, isPowerShell } from '../utils';

/**
 * Check if ts-node is installed, prompt user to install if not
 */
export function checkTsNodeInstallation(): boolean {
    let tsNodeInstalled = false;
    try {
        // Use different commands to check ts-node based on OS and shell type
        let checkCommand = isWindows ? 
            'where ts-node' : 
            'which ts-node';
            
        childProcess.execSync(checkCommand, { stdio: 'ignore' });
        tsNodeInstalled = true;
    } catch (error) {
        // ts-node not installed, prompt user to install
        const installButton = vscode.l10n.t('tsnode.installButton');
        vscode.window.showErrorMessage(
            vscode.l10n.t('tsnode.notInstalled'),
            installButton
        ).then(selection => {
            if (selection === installButton) {
                const terminal = vscode.window.createTerminal(vscode.l10n.t('tsnode.installTerminalName'));
                terminal.show();
                
                // Send different installation commands based on environment
                if (isPowerShell()) {
                    terminal.sendText('npm install -g ts-node');
                    terminal.sendText(`Write-Host "${vscode.l10n.t('tsnode.installCompleted')}"`);
                } else {
                    terminal.sendText('npm install -g ts-node');
                    terminal.sendText(`echo "${vscode.l10n.t('tsnode.installCompleted')}"`);
                }
            }
        });
    }
    return tsNodeInstalled;
} 