import * as childProcess from 'child_process';
import * as vscode from 'vscode';
import * as os from 'os';
import * as path from 'path';
import * as fs from 'fs';
import * as semver from 'semver';
import { isWindows, isWSL, getShellType } from '../utils';
import { t } from '../utils/l10n';

/**
 * Get available Node.js versions installed via nvm or nvm-windows
 */
export function getNodeVersions(): Promise<string[]> {
    return new Promise(resolve => {
        try {
            let output = '';

            if (isWindows && !isWSL) {
                // Windows environment using nvm-windows
                try {
                    output = childProcess.execSync('nvm list', {
                        encoding: 'utf8',
                    });
                } catch (error) {
                    vscode.window.showErrorMessage(t('nodeVersion.nvmNotInstalled.windows'));
                    resolve([]);
                    return;
                }

                // nvm-windows has different output format, needs separate handling
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
                // Linux/macOS/WSL environment using standard nvm
                const homeDir = os.homedir();
                let nvmCommand = '';
                const shellType = getShellType();

                // Try different common nvm installation paths
                const nvmPaths = [
                    path.join(homeDir, '.nvm/nvm.sh'),
                    '/usr/local/share/nvm/nvm.sh',
                    '/opt/nvm/nvm.sh',
                    '/usr/share/nvm/nvm.sh',
                ];

                let nvmScript = '';
                for (const nvmPath of nvmPaths) {
                    try {
                        if (fs.existsSync(nvmPath)) {
                            nvmScript = nvmPath;
                            break;
                        }
                    } catch (error) {
                        // Continue to next path
                        continue;
                    }
                }

                if (!nvmScript) {
                    vscode.window.showErrorMessage(t('nodeVersion.nvmNotInstalled.unix'));
                    resolve([]);
                    return;
                }

                // Build command based on shell type
                switch (shellType) {
                    case 'fish':
                        // Fish shell doesn't support source command in the same way
                        nvmCommand = `bash -c '. "${nvmScript}" && nvm ls --no-alias'`;
                        break;
                    case 'zsh':
                    case 'bash':
                    default:
                        nvmCommand = `. "${nvmScript}" && nvm ls --no-alias`;
                        break;
                }

                try {
                    const shell = shellType === 'fish' ? '/bin/bash' : process.env.SHELL || '/bin/bash';
                    output = childProcess.execSync(nvmCommand, {
                        encoding: 'utf8',
                        shell: shell,
                    });
                } catch (error) {
                    vscode.window.showErrorMessage(t('nodeVersion.nvmNotInstalled.unix'));
                    resolve([]);
                    return;
                }

                // Handle standard nvm output
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
            console.error('NVM Error:', error);
            vscode.window.showErrorMessage(t('nodeVersion.getVersionsFailed'));
            resolve([]);
        }
    });
}

/**
 * Format nvm use command based on environment and shell type
 */
export function getNvmUseCommand(version: string, isDebug: boolean): string {
    const commandParts: string[] = [];

    if (isDebug) {
        commandParts.push('NODE_OPTIONS=');
    }

    commandParts.push('nvm', 'use', version);

    return commandParts.join(' ');
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
        placeHolder: t('nodeVersion.selectPlaceholder'),
        canPickMany: false,
    });

    // Remove 'v' prefix when returning the selected version
    return selected ? selected.substring(1) : undefined;
}
