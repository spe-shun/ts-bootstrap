import * as childProcess from 'child_process';
import * as vscode from 'vscode';
import { isWindows } from '../utils';
import { t } from '../utils/l10n';

const INSTALL_COMMAND = 'npm install --global ts-node';
const INSTALL_TASK_TYPE = 'ts-bootstrap';

type InstallationResult = 'succeeded' | 'failed' | 'cancelled';

let installationConfirmed = false;
let pendingInstallation: Promise<boolean> | undefined;
let installationTaskId = 0;

/**
 * Check both the extension host PATH and the user's login shell PATH. VS Code's
 * extension host can keep an older PATH after a global npm installation.
 */
function canExecute(command: string, args: string[]): Promise<boolean> {
    return new Promise(resolve => {
        childProcess.execFile(command, args, { timeout: 5000, windowsHide: true }, error => {
            resolve(!error);
        });
    });
}

export async function isTsNodeInstalled(): Promise<boolean> {
    if (installationConfirmed) {
        return true;
    }

    if (isWindows) {
        return canExecute('where.exe', ['ts-node']);
    }

    if (await canExecute('ts-node', ['--version'])) {
        return true;
    }

    const userShell = process.env.SHELL;
    if (!userShell) {
        return false;
    }

    return canExecute(userShell, ['-ilc', 'command -v ts-node']);
}

function createInstallationTask(resource: vscode.Uri, taskId: number): vscode.Task {
    const scope = vscode.workspace.getWorkspaceFolder(resource) ?? vscode.TaskScope.Workspace;
    const task = new vscode.Task(
        { type: INSTALL_TASK_TYPE, command: 'install-ts-node', taskId },
        scope,
        t('tsnode.installTerminalName'),
        INSTALL_TASK_TYPE,
        new vscode.ShellExecution(INSTALL_COMMAND),
        [],
    );

    task.presentationOptions = {
        reveal: vscode.TaskRevealKind.Always,
        panel: vscode.TaskPanelKind.Dedicated,
        clear: true,
        echo: true,
        focus: false,
        showReuseMessage: false,
    };

    return task;
}

async function runInstallationTask(resource: vscode.Uri, token: vscode.CancellationToken): Promise<InstallationResult> {
    const taskId = ++installationTaskId;
    const task = createInstallationTask(resource, taskId);
    let execution: vscode.TaskExecution | undefined;
    let cancelled = token.isCancellationRequested;
    let settled = false;
    let resolveResult: (result: InstallationResult) => void;

    const resultPromise = new Promise<InstallationResult>(resolve => {
        resolveResult = resolve;
    });
    const isCurrentTask = (candidate: vscode.TaskExecution) =>
        candidate.task.definition.type === INSTALL_TASK_TYPE && candidate.task.definition.taskId === taskId;
    const disposeAndResolve = (result: InstallationResult) => {
        if (settled) {
            return;
        }
        settled = true;
        processEndDisposable.dispose();
        taskEndDisposable.dispose();
        cancellationDisposable.dispose();
        resolveResult(result);
    };
    const processEndDisposable = vscode.tasks.onDidEndTaskProcess(event => {
        if (!isCurrentTask(event.execution)) {
            return;
        }

        if (cancelled) {
            disposeAndResolve('cancelled');
        } else {
            disposeAndResolve(event.exitCode === 0 ? 'succeeded' : 'failed');
        }
    });
    const taskEndDisposable = vscode.tasks.onDidEndTask(event => {
        if (!isCurrentTask(event.execution)) {
            return;
        }

        // Shell tasks normally emit the process event first. Keep a fallback
        // for a task that ends before its shell process is ever started.
        setTimeout(() => disposeAndResolve(cancelled ? 'cancelled' : 'failed'), 0);
    });
    const cancellationDisposable = token.onCancellationRequested(() => {
        cancelled = true;
        execution?.terminate();
    });

    try {
        execution = await vscode.tasks.executeTask(task);
        if (cancelled) {
            execution.terminate();
        }
    } catch {
        disposeAndResolve('failed');
    }

    return resultPromise;
}

async function installTsNode(resource: vscode.Uri): Promise<boolean> {
    const retryButton = t('tsnode.retryButton');

    const result = await vscode.window.withProgress(
        {
            location: vscode.ProgressLocation.Notification,
            title: t('tsnode.installing'),
            cancellable: true,
        },
        (_progress, token) => runInstallationTask(resource, token),
    );

    if (result === 'succeeded') {
        installationConfirmed = true;
        vscode.window.showInformationMessage(t('tsnode.installCompleted'));
        return true;
    }

    if (result === 'cancelled') {
        return false;
    }

    const selection = await vscode.window.showErrorMessage(t('tsnode.installFailed'), retryButton);
    return selection === retryButton ? installTsNode(resource) : false;
}

async function promptForInstallation(resource: vscode.Uri): Promise<boolean> {
    if (await isTsNodeInstalled()) {
        return true;
    }

    const installButton = t('tsnode.installButton');
    const selection = await vscode.window.showWarningMessage(t('tsnode.notInstalled'), installButton);

    if (selection !== installButton) {
        return false;
    }

    return installTsNode(resource);
}

/**
 * Ensure ts-node is available before running a TypeScript file. Concurrent run
 * requests share the same prompt and installation task.
 */
export async function ensureTsNodeInstallation(resource: vscode.Uri): Promise<boolean> {
    if (pendingInstallation) {
        return pendingInstallation;
    }

    const request = promptForInstallation(resource);
    pendingInstallation = request;

    try {
        return await request;
    } finally {
        if (pendingInstallation === request) {
            pendingInstallation = undefined;
        }
    }
}
