import * as childProcess from 'child_process';
import * as vscode from 'vscode';
import * as os from 'os';
import * as path from 'path';
import * as semver from 'semver';

/**
 * Get available Node.js versions installed via nvm
 */
export function getNodeVersions(): Promise<string[]> {
    return new Promise((resolve) => {
        try {
            // Use nvm command to get installed versions
            const homeDir = os.homedir();
            const nvmScript = path.join(homeDir, '.nvm/nvm.sh');
            const command = `. "${nvmScript}" && nvm ls --no-alias`;
            
            const output = childProcess.execSync(command, { 
                encoding: 'utf8',
                shell: '/bin/zsh'
            });
            
            // Extract installed versions from output
            const versionRegex = /v(\d+\.\d+\.\d+)(?!.*?-> N\/A)/g;
            const versionSet = new Set<string>();
            let match;
            
            while ((match = versionRegex.exec(output)) !== null) {
                versionSet.add(match[1]);
            }
            
            // Use semver to sort versions in descending order (newest first)
            const versions = Array.from(versionSet).sort((a, b) => {
                return semver.rcompare(a, b);
            });
            
            if (versions.length === 0) {
                vscode.window.showWarningMessage('未找到 Node.js 版本。请确保 nvm 正确安装。');
            }
            
            resolve(versions);
        } catch (error) {
            console.error('NVM错误:', error);
            vscode.window.showErrorMessage('获取 Node.js 版本失败。请确保 nvm 在 zsh 中安装。');
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
    
    // Add 'v' prefix to versions for display
    const displayVersions = versions.map(version => `v${version}`);
    
    // Show quick pick to let user select a version
    const selected = await vscode.window.showQuickPick(displayVersions, {
        placeHolder: '选择 Node.js 版本',
        canPickMany: false
    });
    
    // Remove 'v' prefix when returning the selected version
    return selected ? selected.substring(1) : undefined;
} 