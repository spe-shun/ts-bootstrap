import { pathToFileURL } from 'url';
import * as vscode from 'vscode';
import WebSocket = require('ws');
import { TsxDebugRuntime } from './check-tsx';
import { FileRuntime, getExecutionDirectory } from './run-files';

export const DEBUG_SESSION_NAME = 'TS/JS Debugger';
export const DEBUG_SESSION_MARKER = '__tsBootstrapDebug';

interface DebugFileOptions {
    nodeExecutable?: string;
    tsxRuntime?: TsxDebugRuntime;
}

interface CdpProxy {
    host?: string;
    port: number;
    path: string;
}

const CDP_PROXY_COMMAND = 'extension.js-debug.requestCDPProxy';
const CDP_REQUEST_TIMEOUT = 3000;
const CDP_PROXY_RETRY_INTERVAL = 25;
const workerPreparations = new Map<string, Promise<void>>();

export function createDebugConfiguration(
    resource: vscode.Uri,
    runtime: FileRuntime,
    executionDirectory: string,
    options: DebugFileOptions = {},
): vscode.DebugConfiguration | undefined {
    const configuration: vscode.DebugConfiguration = {
        type: 'pwa-node',
        request: 'launch',
        name: DEBUG_SESSION_NAME,
        program: resource.fsPath,
        cwd: executionDirectory,
        console: 'integratedTerminal',
        internalConsoleOptions: 'neverOpen',
        autoAttachChildProcesses: false,
        killBehavior: 'forceful',
        sourceMaps: true,
        skipFiles: ['<node_internals>/**'],
        runtimeExecutable: options.nodeExecutable ?? 'node',
    };

    if (runtime === 'typescript') {
        if (!options.tsxRuntime) {
            return undefined;
        }

        configuration[DEBUG_SESSION_MARKER] = true;
        // Use a simple inspector connection, pause before the loader starts,
        // disable worker debugging, and then continue to the user's breakpoint.
        configuration.attachSimplePort = 0;
        configuration.stopOnEntry = true;
        configuration.runtimeArgs = [
            options.tsxRuntime.loaderFlag,
            pathToFileURL(options.tsxRuntime.loaderPath).toString(),
        ];
    }

    return configuration;
}

function sendCdpCommand(proxy: CdpProxy, method: string): Promise<void> {
    return new Promise((resolve, reject) => {
        const host = proxy.host ?? '127.0.0.1';
        const proxyPath = proxy.path.startsWith('/') ? proxy.path : `/${proxy.path}`;
        const socket = new WebSocket(`ws://${host}:${proxy.port}${proxyPath}`);
        const requestId = 1;
        let settled = false;
        const finish = (error?: Error) => {
            if (settled) {
                return;
            }
            settled = true;
            clearTimeout(timeout);
            socket.close();
            error ? reject(error) : resolve();
        };
        const timeout = setTimeout(() => finish(new Error(`Timed out sending ${method}`)), CDP_REQUEST_TIMEOUT);

        socket.once('open', () => socket.send(JSON.stringify({ id: requestId, method })));
        socket.once('error', finish);
        socket.on('message', data => {
            try {
                const response = JSON.parse(data.toString()) as { id?: number; error?: { message?: string } };
                if (response.id !== requestId) {
                    return;
                }
                finish(response.error ? new Error(response.error.message ?? `Failed to send ${method}`) : undefined);
            } catch (error) {
                finish(error instanceof Error ? error : new Error(String(error)));
            }
        });
    });
}

async function requestCdpProxy(session: vscode.DebugSession): Promise<CdpProxy> {
    const deadline = Date.now() + CDP_REQUEST_TIMEOUT;
    let lastError: unknown;

    while (Date.now() < deadline) {
        try {
            const proxy = await vscode.commands.executeCommand<CdpProxy | undefined>(
                CDP_PROXY_COMMAND,
                session.id,
                true,
            );
            if (proxy) {
                return proxy;
            }
        } catch (error) {
            lastError = error;
        }

        await new Promise(resolve => setTimeout(resolve, CDP_PROXY_RETRY_INTERVAL));
    }

    throw lastError instanceof Error ? lastError : new Error('JavaScript debugger did not provide a CDP proxy');
}

async function disableWorkerDebugging(session: vscode.DebugSession): Promise<void> {
    const proxy = await requestCdpProxy(session);
    await sendCdpCommand(proxy, 'NodeWorker.disable');
}

function isTsBootstrapTarget(session: vscode.DebugSession): boolean {
    const parentSession = session.parentSession;
    return parentSession?.name === DEBUG_SESSION_NAME && !!parentSession.configuration[DEBUG_SESSION_MARKER];
}

function prepareWorkerDebugging(session: vscode.DebugSession): Promise<void> {
    const existing = workerPreparations.get(session.id);
    if (existing) {
        return existing;
    }

    const preparation = disableWorkerDebugging(session).catch(error => {
        console.error('Unable to disable worker debugging:', error);
        throw error;
    });
    workerPreparations.set(session.id, preparation);
    return preparation;
}

export function prepareDebugSession(session: vscode.DebugSession): void {
    if (!isTsBootstrapTarget(session)) {
        return;
    }

    void prepareWorkerDebugging(session).catch(() => undefined);
}

export function createDebugAdapterTracker(
    session: vscode.DebugSession,
    prepareWorker: (target: vscode.DebugSession) => Promise<void> = prepareWorkerDebugging,
): vscode.DebugAdapterTracker | undefined {
    if (!isTsBootstrapTarget(session)) {
        return undefined;
    }

    let continuedFromEntry = false;
    return {
        onDidSendMessage(message: unknown) {
            const event = message as {
                type?: string;
                event?: string;
                body?: { threadId?: number };
            };
            const threadId = event.body?.threadId;
            if (
                continuedFromEntry ||
                event.type !== 'event' ||
                event.event !== 'stopped' ||
                typeof threadId !== 'number'
            ) {
                return;
            }

            continuedFromEntry = true;
            void prepareWorker(session)
                .then(() => session.customRequest('continue', { threadId }))
                .catch(() => undefined);
        },
    };
}

export function releaseDebugSession(session: vscode.DebugSession): void {
    workerPreparations.delete(session.id);
}

export async function debugFile(
    resource: vscode.Uri,
    runtime: FileRuntime,
    options: DebugFileOptions = {},
): Promise<boolean> {
    const configuration = createDebugConfiguration(resource, runtime, getExecutionDirectory(resource), options);
    if (!configuration) {
        return false;
    }

    return vscode.debug.startDebugging(vscode.workspace.getWorkspaceFolder(resource), configuration);
}
