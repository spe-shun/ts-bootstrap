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
    cwd?: string;
    env?: Record<string, string>;
}

interface CdpProxy {
    host?: string;
    port: number;
    path: string;
}

const CDP_PROXY_COMMAND = 'extension.js-debug.requestCDPProxy';
const CDP_REQUEST_TIMEOUT = 3000;
const CDP_PROXY_RETRY_INTERVAL = 25;
interface DebugPreparation {
    session: vscode.DebugSession;
    controller: AbortController;
    promise?: Promise<void>;
    failureReported: boolean;
    userStop?: boolean;
}

const workerPreparations = new Map<string, DebugPreparation>();
let debugOutput: vscode.OutputChannel | undefined;

function getPreparation(session: vscode.DebugSession): DebugPreparation {
    let state = workerPreparations.get(session.id);
    if (!state) {
        state = { session, controller: new AbortController(), failureReported: false };
        workerPreparations.set(session.id, state);
    }
    return state;
}

function cancelled(): Error {
    return new Error('Debug session ended during initialization');
}

function bounded<T>(operation: PromiseLike<T>, signal: AbortSignal, timeoutMs: number): Promise<T> {
    return new Promise((resolve, reject) => {
        if (signal.aborted) {
            void Promise.resolve(operation).catch(() => undefined);
            reject(cancelled());
            return;
        }
        const finish = (error?: Error, value?: T) => {
            clearTimeout(timer);
            signal.removeEventListener('abort', onAbort);
            error ? reject(error) : resolve(value as T);
        };
        const onAbort = () => finish(cancelled());
        const timer = setTimeout(() => finish(new Error('Timed out initializing the TypeScript debugger')), timeoutMs);
        signal.addEventListener('abort', onAbort, { once: true });
        Promise.resolve(operation).then(
            value => finish(undefined, value),
            error => finish(asError(error)),
        );
    });
}

function asError(error: unknown): Error {
    return error instanceof Error ? error : new Error(String(error));
}

function reportPreparationFailure(state: DebugPreparation, error: unknown): void {
    if (state.controller.signal.aborted || state.failureReported) {
        return;
    }
    state.failureReported = true;
    debugOutput ??= vscode.window.createOutputChannel(DEBUG_SESSION_NAME);
    debugOutput.appendLine(`[${state.session.id}] ${asError(error).message}`);
    // Never leave the target silently paused at its entry point after initialization fails.
    if (!state.userStop) {
        state.controller.abort();
        void vscode.debug.stopDebugging(state.session).then(undefined, stopError => {
            debugOutput?.appendLine(`Unable to stop failed debug session: ${asError(stopError).message}`);
        });
    }
    void vscode.window
        .showErrorMessage(
            state.userStop
                ? 'TypeScript debugger initialization failed. Your current breakpoint is preserved; stop and run Debug again to retry.'
                : 'TypeScript debugger initialization failed. Run Debug again to retry.',
            'View Log',
        )
        .then(action => {
            if (action === 'View Log') {
                debugOutput?.show();
            }
        });
}

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
        [DEBUG_SESSION_MARKER]: true,
        ...(options.env ? { env: options.env } : {}),
    };

    if (runtime === 'typescript') {
        if (!options.tsxRuntime) {
            return undefined;
        }

        configuration.__tsBootstrapTsx = true;
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

function sendCdpCommand(proxy: CdpProxy, method: string, signal: AbortSignal): Promise<void> {
    return new Promise((resolve, reject) => {
        if (signal.aborted) {
            reject(cancelled());
            return;
        }
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
            signal.removeEventListener('abort', onAbort);
            // terminate also closes a connection that has not reached OPEN yet.
            socket.terminate();
            error ? reject(error) : resolve();
        };
        const onAbort = () => finish(cancelled());
        const timeout = setTimeout(() => finish(new Error(`Timed out sending ${method}`)), CDP_REQUEST_TIMEOUT);
        signal.addEventListener('abort', onAbort, { once: true });
        socket.once('open', () => {
            if (!settled) {
                socket.send(JSON.stringify({ id: requestId, method }), error => {
                    if (error) {
                        finish(error);
                    }
                });
            }
        });
        socket.on('error', finish);
        socket.once('close', () => finish(new Error('Debugger connection closed before initialization completed')));
        socket.on('message', data => {
            try {
                const response = JSON.parse(data.toString()) as { id?: number; error?: { message?: string } };
                if (response.id !== requestId) {
                    return;
                }
                finish(response.error ? new Error(response.error.message ?? `Failed to send ${method}`) : undefined);
            } catch (error) {
                finish(asError(error));
            }
        });
    });
}

async function requestCdpProxy(session: vscode.DebugSession, signal: AbortSignal): Promise<CdpProxy> {
    const deadline = Date.now() + CDP_REQUEST_TIMEOUT;
    let lastError: unknown;
    while (!signal.aborted && Date.now() < deadline) {
        try {
            const proxy = await bounded(
                vscode.commands.executeCommand<CdpProxy | undefined>(CDP_PROXY_COMMAND, session.id, true),
                signal,
                Math.max(1, deadline - Date.now()),
            );
            if (proxy) {
                return proxy;
            }
        } catch (error) {
            lastError = error;
        }
        if (!signal.aborted) {
            await new Promise(resolve => setTimeout(resolve, CDP_PROXY_RETRY_INTERVAL));
        }
    }
    throw signal.aborted ? cancelled() : (lastError ?? new Error('JavaScript debugger did not provide a CDP proxy'));
}

async function disableWorkerDebugging(session: vscode.DebugSession, signal: AbortSignal): Promise<void> {
    const proxy = await requestCdpProxy(session, signal);
    await sendCdpCommand(proxy, 'NodeWorker.disable', signal);
}

function isTsBootstrapTarget(session: vscode.DebugSession): boolean {
    const parentSession = session.parentSession;
    return (
        parentSession?.name === DEBUG_SESSION_NAME &&
        !!parentSession.configuration[DEBUG_SESSION_MARKER] &&
        !!parentSession.configuration.__tsBootstrapTsx
    );
}

function prepareWorkerDebugging(session: vscode.DebugSession): Promise<void> {
    const state = getPreparation(session);
    state.promise ??= disableWorkerDebugging(session, state.controller.signal);
    return state.promise;
}

export function prepareDebugSession(session: vscode.DebugSession): void {
    if (!isTsBootstrapTarget(session)) {
        return;
    }
    const state = getPreparation(session);
    void prepareWorkerDebugging(session).catch(error => reportPreparationFailure(state, error));
}

export function createDebugAdapterTracker(
    session: vscode.DebugSession,
    prepareWorker: (target: vscode.DebugSession) => Promise<void> = prepareWorkerDebugging,
    preparationTimeout = CDP_REQUEST_TIMEOUT * 2 + 1000,
): vscode.DebugAdapterTracker | undefined {
    if (!isTsBootstrapTarget(session)) {
        return undefined;
    }
    const state = getPreparation(session);
    let continuedFromEntry = false;
    let stopSequence = 0;
    return {
        onDidSendMessage(message: unknown) {
            const event = message as {
                type?: string;
                event?: string;
                body?: { threadId?: number; reason?: string };
            };
            if (event.type !== 'event') {
                return;
            }
            if (event.event === 'terminated' || event.event === 'exited') {
                releaseDebugSession(session);
                return;
            }
            if (event.event !== 'stopped') {
                return;
            }
            const currentStop = ++stopSequence;
            state.userStop = event.body?.reason !== 'entry';
            const threadId = event.body?.threadId;
            if (
                continuedFromEntry ||
                state.controller.signal.aborted ||
                event.body?.reason !== 'entry' ||
                typeof threadId !== 'number'
            ) {
                return;
            }
            continuedFromEntry = true;
            void bounded(
                Promise.resolve().then(() => {
                    if (state.controller.signal.aborted) {
                        throw cancelled();
                    }
                    return prepareWorker(session);
                }),
                state.controller.signal,
                preparationTimeout,
            )
                .then(() => {
                    if (!state.controller.signal.aborted && currentStop === stopSequence) {
                        return session.customRequest('continue', { threadId });
                    }
                })
                .catch(error => reportPreparationFailure(state, error));
        },
        onWillStopSession() {
            releaseDebugSession(session);
        },
        onError(error: Error) {
            reportPreparationFailure(state, error);
            releaseDebugSession(session);
        },
        onExit() {
            releaseDebugSession(session);
        },
    };
}

export function releaseDebugSession(session: vscode.DebugSession): void {
    for (const [id, state] of workerPreparations) {
        if (id === session.id || state.session.parentSession?.id === session.id) {
            state.controller.abort();
            workerPreparations.delete(id);
        }
    }
}

export function disposeDebugSessions(): void {
    for (const state of workerPreparations.values()) {
        state.controller.abort();
    }
    workerPreparations.clear();
    debugOutput?.dispose();
    debugOutput = undefined;
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
