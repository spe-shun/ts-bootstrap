import * as vscode from 'vscode';

export const EXTENSION_NAME = 'ts-bootstrap';

export type DebugConsole = 'internalConsole' | 'integratedTerminal';

/** Prefer the Debug Console unless this file explicitly needs an interactive terminal. */
export function getDebugConsole(resource: vscode.Uri): DebugConsole {
    const console = vscode.workspace.getConfiguration(EXTENSION_NAME, resource).get<string>('debugConsole');
    return console === 'integratedTerminal' ? 'integratedTerminal' : 'internalConsole';
}

/** Read configuration for the target file, including multi-root folder overrides. */
export function executeInWorkspaceDirectory(resource: vscode.Uri): boolean {
    return (
        vscode.workspace.getConfiguration(EXTENSION_NAME, resource).get<boolean>('executeInCurrentDirectory') ?? true
    );
}
