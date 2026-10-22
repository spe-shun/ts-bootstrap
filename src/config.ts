import * as vscode from 'vscode';

export const EXTENSION_NAME = 'ts-bootstrap';

/** Read configuration for the target file, including multi-root folder overrides. */
export function executeInWorkspaceDirectory(resource: vscode.Uri): boolean {
    return (
        vscode.workspace.getConfiguration(EXTENSION_NAME, resource).get<boolean>('executeInCurrentDirectory') ?? true
    );
}
