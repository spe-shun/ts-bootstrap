import * as childProcess from 'child_process';
import * as vscode from 'vscode';
import { isWindows } from '../utils';
import { t } from '../utils/l10n';

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
        const installButton = t('tsnode.installButton');
        vscode.window.showWarningMessage(t('tsnode.notInstalled'), installButton).then(selection => {
            if (selection === installButton) {
                const terminal = vscode.window.createTerminal(t('tsnode.installTerminalName'));
                terminal.show();

                // Install ts-node
                terminal.sendText('npm install -g ts-node');

                // Wait for installation to complete, then check if it was successful
                setTimeout(() => {
                    try {
                        let checkCommand = isWindows ? 'where ts-node' : 'which ts-node';
                        childProcess.execSync(checkCommand, { stdio: 'ignore' });

                        // Installation successful
                        vscode.window.showInformationMessage(t('tsnode.installCompleted'));
                    } catch (installError) {
                        // Installation failed, prompt for manual installation
                        vscode.window.showErrorMessage(t('tsnode.installFailed'));
                    }
                }, 2000); // Wait 2 seconds for installation to complete
            }
        });
    }
    return tsNodeInstalled;
}
