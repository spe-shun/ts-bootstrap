import * as childProcess from 'child_process';
import * as vscode from 'vscode';
import * as os from 'os';
import * as path from 'path';
import * as semver from 'semver';
import { isWindows, isWSL, isPowerShell } from '../utils';

/**
 * Get available Node.js versions installed via nvm or nvm-windows
 */
export function getNodeVersions(): Promise<string[]> {
    return new Promise((resolve) => {
        try {
            let output = '';
            
            if (isWindows && !isWSL) {
                // Windows 环境下使用 nvm-windows
                try {
                    output = childProcess.execSync('nvm list', { 
                        encoding: 'utf8' 
                    });
                } catch (error) {
                    vscode.window.showErrorMessage('获取 Node.js 版本失败。请确保 nvm-windows 已安装。');
                    resolve([]);
                    return;
                }
                
                // nvm-windows 输出格式不同，需要单独处理
                const versionRegex = /v(\d+\.\d+\.\d+)/g;
                const versionSet = new Set<string>();
                let match;
                
                while ((match = versionRegex.exec(output)) !== null) {
                    versionSet.add(match[1]);
                }
                
                const versions = Array.from(versionSet).sort((a, b) => {
                    return semver.rcompare(a, b);
                });
                
                resolve(versions);
            } else {
                // Linux/macOS/WSL 环境下使用标准 nvm
                const homeDir = os.homedir();
                let nvmCommand = '';
                
                if (isWSL) {
                    // WSL 环境
                    const nvmScript = path.join(homeDir, '.nvm/nvm.sh');
                    nvmCommand = `. "${nvmScript}" && nvm ls --no-alias`;
                } else {
                    // 非 WSL 的 Linux/macOS 环境
                    const nvmScript = path.join(homeDir, '.nvm/nvm.sh');
                    nvmCommand = `. "${nvmScript}" && nvm ls --no-alias`;
                }
                
                try {
                    output = childProcess.execSync(nvmCommand, { 
                        encoding: 'utf8',
                        shell: process.env.SHELL || '/bin/bash'
                    });
                } catch (error) {
                    vscode.window.showErrorMessage('获取 Node.js 版本失败。请确保 nvm 已安装。');
                    resolve([]);
                    return;
                }
                
                // 处理标准 nvm 输出
                const versionRegex = /v(\d+\.\d+\.\d+)(?!.*?-> N\/A)/g;
                const versionSet = new Set<string>();
                let match;
                
                while ((match = versionRegex.exec(output)) !== null) {
                    versionSet.add(match[1]);
                }
                
                const versions = Array.from(versionSet).sort((a, b) => {
                    return semver.rcompare(a, b);
                });
                
                resolve(versions);
            }
        } catch (error) {
            console.error('NVM错误:', error);
            vscode.window.showErrorMessage('获取 Node.js 版本失败。');
            resolve([]);
        }
    });
}

/**
 * Format nvm use command based on environment
 */
export function getNvmUseCommand(version: string): string {
    if (isWindows && !isWSL) {
        // Windows 使用 nvm-windows 格式
        return `nvm use ${version}`;
    } else {
        // Linux/macOS/WSL 使用标准 nvm 格式
        return `nvm use ${version}`;
    }
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
        placeHolder: 'Select Node.js version',
        canPickMany: false
    });
    
    // Remove 'v' prefix when returning the selected version
    return selected ? selected.substring(1) : undefined;
} 