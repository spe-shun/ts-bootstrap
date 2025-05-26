import * as childProcess from 'child_process';
import * as vscode from 'vscode';
import { isWindows, getShellType, getCommandSeparator } from '../utils';

/**
 * Check if ts-node is installed, prompt user to install if not
 */
export function checkTsNodeInstallation(): boolean {
    let tsNodeInstalled = false;
    try {
        // Use different commands to check ts-node based on OS
        let checkCommand = isWindows ? 'where ts-node' : 'which ts-node';
            
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
                
                const shellType = getShellType();
                const commandSeparator = getCommandSeparator();
                
                // Send different installation commands based on shell type
                terminal.sendText('npm install -g ts-node');
                
                // Show completion message based on shell type
                switch (shellType) {
                    case 'powershell':
                        terminal.sendText(`Write-Host "${vscode.l10n.t('tsnode.installCompleted')}"`);
                        break;
                    case 'cmd':
                        terminal.sendText(`echo ${vscode.l10n.t('tsnode.installCompleted')}`);
                        break;
                    case 'fish':
                        terminal.sendText(`echo "${vscode.l10n.t('tsnode.installCompleted')}"`);
                        break;
                    default:
                        // bash, zsh and other Unix-like shells
                        terminal.sendText(`echo "${vscode.l10n.t('tsnode.installCompleted')}"`);
                        break;
                }
                
                // Suggest restarting VS Code for PATH updates
                vscode.window.showInformationMessage(
                    vscode.l10n.t('tsnode.restartSuggestion'),
                    vscode.l10n.t('tsnode.restartButton')
                ).then(restartSelection => {
                    if (restartSelection === vscode.l10n.t('tsnode.restartButton')) {
                        vscode.commands.executeCommand('workbench.action.reloadWindow');
                    }
                });
            }
        });
    }
    return tsNodeInstalled;
} 