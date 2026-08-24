import * as vscode from 'vscode';
import runFile, { FileRuntime, getFileRuntime } from './scripts/run-files';
import { ensureTsNodeInstallation } from './scripts/check-tsnode';
import { selectNodeVersion } from './scripts/node-version';
import { t } from './utils/l10n';

const DEBUG_TERMINAL_NAME = 'TS/JS Debugger';
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

async function createRunTerminal(debug: boolean): Promise<vscode.Terminal | undefined> {
    const name = debug ? DEBUG_TERMINAL_NAME : EXEC_TERMINAL_NAME;
    disposeTerminal(name);

    if (!debug) {
        return vscode.window.createTerminal({ name });
    }

    try {
        await vscode.commands.executeCommand('extension.js-debug.createDebuggerTerminal', '', undefined, { name });
    } catch {
        vscode.window.showErrorMessage(t('terminal.unableToCreateDebugTerminal'));
        return undefined;
    }

    const terminal = vscode.window.terminals.find(candidate => candidate.name === name);
    if (!terminal) {
        vscode.window.showErrorMessage(t('terminal.unableToCreateDebugTerminal'));
    }
    return terminal;
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

    if (target.runtime === 'typescript' && !(await ensureTsNodeInstallation(target.resource))) {
        return;
    }

    const terminal = await createRunTerminal(options.debug);
    if (!terminal) {
        return;
    }

    runFile(terminal, target.resource, options.debug, nodeVersion);
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
    );
}

export function deactivate() {
    [EXEC_TERMINAL_NAME, DEBUG_TERMINAL_NAME].forEach(disposeTerminal);
}
