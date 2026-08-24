import * as path from 'path';
import * as vscode from 'vscode';
import config from '../config';
import { getWorkSpaceFolderName, normalizePath, getCommandSeparator, getShellType } from '../utils';
import { getNvmUseCommand } from './node-version';

export type FileRuntime = 'javascript' | 'typescript';

const JAVASCRIPT_EXTENSIONS = new Set(['.js', '.cjs', '.mjs']);
const TYPESCRIPT_EXTENSIONS = new Set(['.ts', '.cts', '.mts']);

export function getFileRuntime(fileName: string): FileRuntime | undefined {
    const extension = path.extname(fileName).toLowerCase();

    if (JAVASCRIPT_EXTENSIONS.has(extension)) {
        return 'javascript';
    }
    if (TYPESCRIPT_EXTENSIONS.has(extension)) {
        return 'typescript';
    }
    return undefined;
}

function quoteShellArgument(value: string): string {
    const shellType = getShellType();

    if (shellType === 'powershell') {
        return `'${value.replace(/'/g, "''")}'`;
    }
    if (shellType === 'cmd') {
        return `"${value.replace(/"/g, '""')}"`;
    }
    return `'${value.replace(/'/g, `'"'"'`)}'`;
}

function getChangeDirectoryCommand(directory: string): string {
    const quotedDirectory = quoteShellArgument(directory);

    if (getShellType() === 'powershell') {
        return `Set-Location -LiteralPath ${quotedDirectory}`;
    }
    if (getShellType() === 'cmd') {
        return `cd /d ${quotedDirectory}`;
    }
    return `cd ${quotedDirectory}`;
}

const runFile = (terminal: vscode.Terminal, resource: vscode.Uri, isDebug: boolean, nodeVersion?: string) => {
    const baseName = resource.fsPath;
    const runtime = getFileRuntime(baseName);

    if (!runtime) {
        return;
    }

    let executor = runtime === 'javascript' ? 'node' : 'ts-node';
    const commandSeparator = getCommandSeparator();

    if (nodeVersion) {
        executor = `${getNvmUseCommand(nodeVersion, isDebug)} ${commandSeparator} ${executor}`;
    }

    const fileDirectory = path.dirname(baseName);
    const workspaceDirectory = getWorkSpaceFolderName(resource);
    const executionDirectory = config.raw.executeInCurrentDirectory
        ? (workspaceDirectory ?? fileDirectory)
        : fileDirectory;
    const targetPath = path.relative(executionDirectory, baseName) || path.basename(baseName);
    const executeCommand = `${executor} ${quoteShellArgument(normalizePath(targetPath))}`;
    const command = [getChangeDirectoryCommand(normalizePath(executionDirectory)), executeCommand].join(
        ` ${commandSeparator} `,
    );

    terminal.show();
    terminal.sendText(command);
};

export default runFile;
