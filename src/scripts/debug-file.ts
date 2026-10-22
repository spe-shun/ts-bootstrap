import { pathToFileURL } from 'url';
import * as path from 'path';
import * as vscode from 'vscode';
import { getDebugConsole } from '../config';
import { TsxDebugRuntime } from './check-tsx';
import { FileRuntime, getExecutionDirectory } from './run-files';

export const DEBUG_SESSION_NAME = 'TS/JS Debugger';
export const DEBUG_SESSION_MARKER = '__tsBootstrapDebug';

interface DebugFileOptions {
    nodeExecutable?: string;
    tsxRuntime?: TsxDebugRuntime;
    cwd?: string;
    env?: Record<string, string>;
}

export function createDebugConfiguration(
    resource: vscode.Uri,
    runtime: FileRuntime,
    executionDirectory: string,
    options: DebugFileOptions = {},
): vscode.DebugConfiguration | undefined {
    const console = getDebugConsole(resource);
    const configuration: vscode.DebugConfiguration = {
        type: 'pwa-node',
        request: 'launch',
        name: `${DEBUG_SESSION_NAME}: ${path.basename(resource.fsPath)}`,
        program: resource.fsPath,
        cwd: executionDirectory,
        console,
        internalConsoleOptions: console === 'internalConsole' ? 'openOnSessionStart' : 'neverOpen',
        ...(console === 'internalConsole' ? { outputCapture: 'std' } : {}),
        // Let js-debug own inspector startup and worker handling.
        autoAttachChildProcesses: false,
        stopOnEntry: false,
        killBehavior: 'forceful',
        sourceMaps: true,
        skipFiles: ['<node_internals>/**'],
        runtimeExecutable: options.nodeExecutable ?? 'node',
        [DEBUG_SESSION_MARKER]: true,
        ...(options.env ? { env: options.env } : {}),
    };

    if (runtime === 'typescript') {
        if (!options.tsxRuntime) {
            return undefined;
        }

        configuration.runtimeArgs = [
            options.tsxRuntime.loaderFlag,
            pathToFileURL(options.tsxRuntime.loaderPath).toString(),
        ];
    }

    return configuration;
}

export async function debugFile(
    resource: vscode.Uri,
    runtime: FileRuntime,
    options: DebugFileOptions = {},
): Promise<boolean> {
    const configuration = createDebugConfiguration(
        resource,
        runtime,
        options.cwd ?? getExecutionDirectory(resource),
        options,
    );
    if (!configuration) {
        return false;
    }

    return vscode.debug.startDebugging(vscode.workspace.getWorkspaceFolder(resource), configuration);
}
