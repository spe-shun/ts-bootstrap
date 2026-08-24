import * as childProcess from 'child_process';
import * as vscode from 'vscode';
import * as os from 'os';
import * as path from 'path';
import * as fs from 'fs';
import * as semver from 'semver';
import { isWindows, isWSL } from '../utils';
import { t } from '../utils/l10n';

const resolvedNodeExecutables = new Map<string, string>();

function findNvmScript(): string | undefined {
    const homeDir = os.homedir();
    const candidates = Array.from(
        new Set(
            [
                process.env.NVM_DIR ? path.join(process.env.NVM_DIR, 'nvm.sh') : undefined,
                path.join(homeDir, '.nvm/nvm.sh'),
                '/usr/local/share/nvm/nvm.sh',
                '/opt/nvm/nvm.sh',
                '/usr/share/nvm/nvm.sh',
            ].filter((candidate): candidate is string => !!candidate),
        ),
    );

    return candidates.find(candidate => {
        try {
            return fs.existsSync(candidate);
        } catch {
            return false;
        }
    });
}

function getNvmDirectory(): string | undefined {
    const nvmScript = findNvmScript();
    return nvmScript ? path.dirname(nvmScript) : undefined;
}

function quotePosixArgument(value: string): string {
    return `'${value.replace(/'/g, `'"'"'`)}'`;
}

function findExistingNodeExecutable(candidates: string[]): string | undefined {
    return candidates.find(candidate => {
        try {
            return fs.statSync(candidate).isFile();
        } catch {
            return false;
        }
    });
}

function getUnixNodeExecutableCandidates(nvmDirectory: string, version: string): string[] {
    return [
        path.join(nvmDirectory, 'versions', 'node', `v${version}`, 'bin', 'node'),
        path.join(nvmDirectory, 'versions', 'node', version, 'bin', 'node'),
        path.join(nvmDirectory, `v${version}`, 'bin', 'node'),
        path.join(nvmDirectory, version, 'bin', 'node'),
    ];
}

function getInstalledUnixNodeVersions(nvmDirectory: string): string[] {
    const versionsDirectory = path.join(nvmDirectory, 'versions', 'node');

    try {
        return fs
            .readdirSync(versionsDirectory)
            .map(directoryName => directoryName.replace(/^v/, ''))
            .filter(
                version =>
                    semver.valid(version) &&
                    !!findExistingNodeExecutable(getUnixNodeExecutableCandidates(nvmDirectory, version)),
            )
            .sort((a, b) => semver.rcompare(a, b));
    } catch {
        return [];
    }
}

/**
 * Resolve an installed nvm version to its concrete Node.js executable. Passing
 * this path to js-debug avoids its runtimeVersion PATH rewriting.
 */
export async function getNodeExecutable(version: string): Promise<string | undefined> {
    if (!semver.valid(version)) {
        return undefined;
    }

    const cachedExecutable = resolvedNodeExecutables.get(version);
    if (cachedExecutable && findExistingNodeExecutable([cachedExecutable])) {
        return cachedExecutable;
    }

    if (isWindows && !isWSL) {
        const roots = [
            process.env.NVM_HOME,
            process.env.APPDATA ? path.join(process.env.APPDATA, 'nvm') : undefined,
        ].filter((candidate): candidate is string => !!candidate);
        const executable = findExistingNodeExecutable(
            roots.flatMap(root => [path.join(root, `v${version}`, 'node.exe'), path.join(root, version, 'node.exe')]),
        );
        if (executable) {
            resolvedNodeExecutables.set(version, executable);
        }
        return executable;
    }

    const nvmDirectory = getNvmDirectory();
    if (!nvmDirectory) {
        return undefined;
    }

    const directExecutable = findExistingNodeExecutable(getUnixNodeExecutableCandidates(nvmDirectory, version));
    if (directExecutable) {
        resolvedNodeExecutables.set(version, directExecutable);
        return directExecutable;
    }

    return new Promise(resolve => {
        const nvmScript = path.join(nvmDirectory, 'nvm.sh');
        const command = `. ${quotePosixArgument(nvmScript)} && nvm which ${quotePosixArgument(version)}`;
        childProcess.execFile(
            '/bin/bash',
            ['-lc', command],
            { encoding: 'utf8', timeout: 10000, windowsHide: true },
            (error, stdout) => {
                if (error) {
                    resolve(undefined);
                    return;
                }

                const candidates = stdout
                    .split(/\r?\n/)
                    .map(line => line.trim())
                    .filter(candidate => candidate.length > 0);
                const executable = findExistingNodeExecutable(candidates.reverse());
                if (executable) {
                    resolvedNodeExecutables.set(version, executable);
                }
                resolve(executable);
            },
        );
    });
}

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
                const nvmDirectory = getNvmDirectory();

                if (!nvmDirectory) {
                    vscode.window.showErrorMessage(t('nodeVersion.nvmNotInstalled.unix'));
                    resolve([]);
                    return;
                }

                const installedVersions = getInstalledUnixNodeVersions(nvmDirectory);
                if (installedVersions.length > 0) {
                    resolve(installedVersions);
                    return;
                }

                try {
                    const nvmScript = path.join(nvmDirectory, 'nvm.sh');
                    output = childProcess.execSync(`. ${quotePosixArgument(nvmScript)} && nvm ls --no-alias`, {
                        encoding: 'utf8',
                        shell: '/bin/bash',
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
export function getNvmUseCommand(version: string): string {
    return ['nvm', 'use', version].join(' ');
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
