import * as childProcess from 'child_process';
import * as vscode from 'vscode';

/**
 * Get available Node.js versions installed via nvm
 */
export function getNodeVersions(): Promise<string[]> {
    return new Promise((resolve) => {
        try {
            // Execute 'nvm list' command through zsh to get available Node.js versions
            const command = 'nvm list';
            const output = childProcess.execSync(command, { 
                encoding: 'utf8',
                shell: '/bin/zsh'
            });
            
            // Parse the output to extract version numbers
            const versionRegex = /v(\d+\.\d+\.\d+)/g;
            const versions: string[] = [];
            let match;
            
            while ((match = versionRegex.exec(output)) !== null) {
                versions.push(match[1]);
            }
            
            if (versions.length === 0) {
                vscode.window.showWarningMessage('No Node.js versions found via nvm. Make sure nvm is installed correctly.');
            }
            
            resolve(versions);
        } catch (error) {
            vscode.window.showErrorMessage('Failed to get Node.js versions. Make sure nvm is installed in zsh.');
            resolve([]);
        }
    });
}

/**
 * Prompt user to select a Node.js version
 */
export async function selectNodeVersion(): Promise<string | undefined> {
    const versions = await getNodeVersions();
    
    if (versions.length === 0) {
        return undefined;
    }
    
    // Show quick pick to let user select a version
    return vscode.window.showQuickPick(versions, {
        placeHolder: '选择 Node.js 版本',
        canPickMany: false
    });
} 