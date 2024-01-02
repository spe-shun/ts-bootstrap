import * as vscode from 'vscode';

export const getWorkSpaceFolderName = () => {
    const workspaceFolders = vscode.workspace.workspaceFolders;
    if (workspaceFolders?.length !== 1) {
        return null;
    }
    return workspaceFolders[0].uri.path;
};
