import * as vscode from 'vscode';
import runFile, { FileRuntime, getFileRuntime } from './scripts/run-files';
import { ensureTsxInstallation, getTsxDebugRuntime, TsxDebugRuntime } from './scripts/check-tsx';
import { createDebugAdapterTracker, debugFile, prepareDebugSession, releaseDebugSession } from './scripts/debug-file';
import { getNodeExecutable, selectNodeVersion } from './scripts/node-version';
import { t } from './utils/l10n';

const EXEC_TERMINAL_NAME = 'TS/JS Runner';

interface RunTarget {
    resource: vscode.Uri;
    runtime: FileRuntime;
}

interface RunOptions {
    debug: boolean;
    selectVersion: boolean;
}

async function getRunTarget(): Promise<RunTarget | undefined> {
    const editor = vscode.window.activeTextEditor;
    if (!editor) {
        vscode.window.showWarningMessage(t('file.noFileSelected'));
        return undefined;
    }

    const document = editor.document;
    const runtime = getFileRuntime(document.fileName);

    if (!runtime) {
        vscode.window.showWarningMessage(t('file.unsupportedType'));
        return undefined;
    }

    if (document.isDirty && !(await document.save())) {
        return undefined;
    }

    return { resource: document.uri, runtime };
}

function disposeTerminal(name: string) {
    vscode.window.terminals.filter(terminal => terminal.name === name).forEach(terminal => terminal.dispose());
}

function createRunTerminal(): vscode.Terminal {
    disposeTerminal(EXEC_TERMINAL_NAME);
    return vscode.window.createTerminal({ name: EXEC_TERMINAL_NAME });
}

async function executeRunCommand(options: RunOptions) {
    if (options.debug && vscode.debug.activeDebugSession) {
        vscode.window.showWarningMessage(t('terminal.debugSessionRunning'));
        return;
    }

    const target = await getRunTarget();
    if (!target) {
        return;
    }

    const nodeVersion = options.selectVersion ? await selectNodeVersion() : undefined;
    if (options.selectVersion && !nodeVersion) {
        return;
    }

    const nodeExecutable = nodeVersion ? await getNodeExecutable(nodeVersion) : undefined;
    if (options.debug && nodeVersion && !nodeExecutable) {
        vscode.window.showErrorMessage(t('nodeVersion.executableNotFound'));
        return;
    }

    let tsxRuntime: TsxDebugRuntime | undefined;
    if (target.runtime === 'typescript') {
        if (!(await ensureTsxInstallation(target.resource, nodeVersion, nodeExecutable))) {
            return;
        }

        if (options.debug) {
            tsxRuntime = await getTsxDebugRuntime(nodeVersion, nodeExecutable);
            if (!tsxRuntime) {
                vscode.window.showErrorMessage(t('tsx.debugRuntimeUnavailable'));
                return;
            }
        }
    }

    if (options.debug) {
        try {
            const started = await debugFile(target.resource, target.runtime, { nodeExecutable, tsxRuntime });
            if (!started) {
                vscode.window.showErrorMessage(t('debug.unableToStart'));
            }
        } catch {
            vscode.window.showErrorMessage(t('debug.unableToStart'));
        }
        return;
    }

    runFile(createRunTerminal(), target.resource, nodeVersion);
}

export function activate(context: vscode.ExtensionContext) {
    const commands: Array<[string, RunOptions]> = [
        ['extension.ts-bootstrap.execTerminal', { debug: false, selectVersion: false }],
        ['extension.ts-bootstrap.debugTerminal', { debug: true, selectVersion: false }],
        ['extension.ts-bootstrap.execTerminalWithNodeVersion', { debug: false, selectVersion: true }],
        ['extension.ts-bootstrap.debugTerminalWithNodeVersion', { debug: true, selectVersion: true }],
    ];

    context.subscriptions.push(
        ...commands.map(([command, options]) =>
            vscode.commands.registerCommand(command, () => executeRunCommand(options)),
        ),
        vscode.debug.registerDebugAdapterTrackerFactory('pwa-node', { createDebugAdapterTracker }),
        vscode.debug.onDidStartDebugSession(prepareDebugSession),
        vscode.debug.onDidTerminateDebugSession(releaseDebugSession),
    );
}

export function deactivate() {
    disposeTerminal(EXEC_TERMINAL_NAME);
}
