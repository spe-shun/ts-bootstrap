import * as path from 'path';
import * as vscode from 'vscode';
import { executeInWorkspaceDirectory } from '../config';
import { pathToFileURL } from 'url';
import { TsxDebugRuntime } from './check-tsx';
import { getWorkSpaceFolderName } from '../utils';

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

export function getExecutionDirectory(resource: vscode.Uri): string {
    const fileDirectory = path.dirname(resource.fsPath);
    const workspaceDirectory = getWorkSpaceFolderName(resource);
    return executeInWorkspaceDirectory(resource) ? (workspaceDirectory ?? fileDirectory) : fileDirectory;
}

export interface ExecutionPlan {
    resource: vscode.Uri;
    runtime: FileRuntime;
    nodeExecutable: string;
    tsxRuntime?: TsxDebugRuntime;
    cwd: string;
    env: Record<string, string>;
    args: string[];
}

export function createExecutionPlan(
    resource: vscode.Uri,
    runtime: FileRuntime,
    nodeExecutable: string,
    tsxRuntime?: TsxDebugRuntime,
): ExecutionPlan {
    if (runtime === 'typescript' && !tsxRuntime) {
        throw new Error('TypeScript requires a resolved tsx loader.');
    }
    const env: Record<string, string> = {};
    for (const [key, value] of Object.entries(process.env)) {
        if (value !== undefined) {
            env[key] = value;
        }
    }
    const pathKey = Object.keys(env).find(key => key.toLowerCase() === 'path') ?? 'PATH';
    env[pathKey] = [path.dirname(nodeExecutable), env[pathKey]].filter(Boolean).join(path.delimiter);
    const args = tsxRuntime ? [tsxRuntime.loaderFlag, pathToFileURL(tsxRuntime.loaderPath).toString()] : [];
    args.push(resource.fsPath);
    return { resource, runtime, nodeExecutable, tsxRuntime, cwd: getExecutionDirectory(resource), env, args };
}

// A normal terminal closes when its executable exits. For standalone files,
// retain successful/failed output until Enter without invoking any shell.
export const STANDALONE_RUNNER = `
const { spawn } = require('node:child_process');
let finished = false;
function finish(code, error) {
    if (finished) return;
    finished = true;
    if (error) console.error(error.message);
    console.log('\\n[TS/JS Runner] Exit code: ' + code + '. Press Enter to close.');
    process.stdin.resume();
    process.stdin.once('data', () => process.exit(code));
}
const child = spawn(process.execPath, process.argv.slice(1), { stdio: 'inherit' });
child.once('error', error => finish(1, error));
child.once('exit', (code, signal) => finish(code ?? 1, signal ? new Error(signal) : undefined));
`;

/** Only handles created by this runner are owned. Other tasks and terminals are untouched. */
export class FileTaskRunner implements vscode.Disposable {
    private executions = new Map<string, vscode.TaskExecution>();
    private terminals = new Map<string, vscode.Terminal>();
    private terminalSubscription = vscode.window.onDidCloseTerminal(terminal => {
        for (const [key, owned] of this.terminals) {
            if (owned === terminal) {
                this.terminals.delete(key);
            }
        }
    });
    private queues = new Map<string, Promise<void>>();
    private disposed = false;
    private endedExecutions = new WeakSet<vscode.TaskExecution>();
    private endSubscription = vscode.tasks.onDidEndTask(event => {
        this.endedExecutions.add(event.execution);
        for (const [key, execution] of this.executions) {
            if (execution === event.execution) {
                this.executions.delete(key);
            }
        }
    });

    run(plan: ExecutionPlan): Promise<void> {
        const key = plan.resource.toString();
        // Serialize rapid clicks for the same file; different files remain independent.
        const request = (this.queues.get(key) ?? Promise.resolve())
            .catch(() => undefined)
            .then(async () => {
                if (this.disposed) {
                    return;
                }
                const previousTerminal = this.terminals.get(key);
                if (previousTerminal) {
                    await this.closeTerminal(previousTerminal);
                    this.terminals.delete(key);
                }
                const previous = this.executions.get(key);
                if (previous) {
                    await this.terminate(previous);
                    this.executions.delete(key);
                }
                if (this.disposed) {
                    return;
                }
                const folder = vscode.workspace.getWorkspaceFolder(plan.resource);
                if (!folder) {
                    // VS Code tasks require a workspace folder. Use Node itself as the
                    // terminal executable for standalone files, never a shell string.
                    const terminal = vscode.window.createTerminal({
                        name: `TS/JS Runner: ${path.basename(plan.resource.fsPath)}`,
                        shellPath: plan.nodeExecutable,
                        shellArgs: ['-e', STANDALONE_RUNNER, '--', ...plan.args],
                        cwd: plan.cwd,
                        env: plan.env,
                        strictEnv: true,
                    });
                    this.terminals.set(key, terminal);
                    terminal.show();
                    return;
                }
                const task = new vscode.Task(
                    { type: 'ts-bootstrap-run', file: key },
                    folder,
                    `TS/JS Runner: ${path.basename(plan.resource.fsPath)}`,
                    'ts-bootstrap',
                    new vscode.ProcessExecution(plan.nodeExecutable, plan.args, { cwd: plan.cwd, env: plan.env }),
                    [],
                );
                task.presentationOptions = {
                    reveal: vscode.TaskRevealKind.Always,
                    panel: vscode.TaskPanelKind.Dedicated,
                    clear: true,
                    echo: true,
                    showReuseMessage: false,
                };
                const execution = await vscode.tasks.executeTask(task);
                if (this.disposed) {
                    execution.terminate();
                } else if (!this.endedExecutions.has(execution)) {
                    this.executions.set(key, execution);
                }
            });
        this.queues.set(key, request);
        void request
            .finally(() => {
                if (this.queues.get(key) === request) {
                    this.queues.delete(key);
                }
            })
            .catch(() => undefined);
        return request;
    }

    private closeTerminal(terminal: vscode.Terminal): Promise<void> {
        return new Promise((resolve, reject) => {
            const subscription = vscode.window.onDidCloseTerminal(closed => {
                if (closed === terminal) {
                    clearTimeout(timeout);
                    subscription.dispose();
                    resolve();
                }
            });
            const timeout = setTimeout(() => {
                subscription.dispose();
                reject(new Error('Previous run terminal has not closed. Close it before retrying.'));
            }, 5000);
            terminal.dispose();
        });
    }

    private terminate(execution: vscode.TaskExecution): Promise<void> {
        return new Promise((resolve, reject) => {
            const subscription = vscode.tasks.onDidEndTask(event => {
                if (event.execution === execution) {
                    clearTimeout(timeout);
                    subscription.dispose();
                    resolve();
                }
            });
            const timeout = setTimeout(() => {
                subscription.dispose();
                reject(new Error('Previous run has not stopped. Stop its task before retrying.'));
            }, 5000);
            try {
                execution.terminate();
            } catch (error) {
                clearTimeout(timeout);
                subscription.dispose();
                reject(error);
            }
        });
    }

    dispose(): void {
        this.disposed = true;
        this.endSubscription.dispose();
        this.terminalSubscription.dispose();
        for (const terminal of this.terminals.values()) {
            terminal.dispose();
        }
        this.terminals.clear();
        for (const execution of this.executions.values()) {
            execution.terminate();
        }
        this.executions.clear();
    }
}
