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

export function getFileExecutor(runtime: FileRuntime): 'node' | 'tsx' {
    return runtime === 'javascript' ? 'node' : 'tsx';
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

export function getExecutionDirectory(resource: vscode.Uri): string {
    const fileDirectory = path.dirname(resource.fsPath);
    const workspaceDirectory = getWorkSpaceFolderName(resource);

    return config.raw.executeInCurrentDirectory ? (workspaceDirectory ?? fileDirectory) : fileDirectory;
}

const runFile = (terminal: vscode.Terminal, resource: vscode.Uri, nodeVersion?: string) => {
    const baseName = resource.fsPath;
    const runtime = getFileRuntime(baseName);

    if (!runtime) {
        return;
    }

    let executor: string = getFileExecutor(runtime);
    const commandSeparator = getCommandSeparator();

    if (nodeVersion) {
        executor = `${getNvmUseCommand(nodeVersion)} ${commandSeparator} ${executor}`;
    }

    const executionDirectory = getExecutionDirectory(resource);
    const targetPath = path.relative(executionDirectory, baseName) || path.basename(baseName);
    const executeCommand = `${executor} ${quoteShellArgument(normalizePath(targetPath))}`;
    const command = [getChangeDirectoryCommand(normalizePath(executionDirectory)), executeCommand].join(
        ` ${commandSeparator} `,
    );

    terminal.show();
    terminal.sendText(command);
};

export default runFile;
