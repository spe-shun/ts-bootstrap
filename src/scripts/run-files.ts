import * as path from 'path';
import * as vscode from 'vscode';
import config from '../config';
import { getWorkSpaceFolderName } from '../utils';

const runFile = async (terminal: vscode.Terminal) => {
    const activeTextEditor = vscode.window.activeTextEditor;

    if (activeTextEditor) {
        const baseName = activeTextEditor.document.fileName;

        terminal.show();

        if (config.raw.executeInCurrentDirectory) {
            const currPath = getWorkSpaceFolderName();
            if (!currPath) {
                terminal.sendText(`ts-node ${baseName}`);
            } else {
                terminal.sendText(`ts-node ${baseName.replace(currPath, '.')}`);
            }
        } else {
            const pathName = path.dirname(baseName);
            const fileName = path.basename(baseName);
            terminal.sendText(`cd ${pathName} && ts-node ./${fileName}`);
        }
    } else {
        vscode.window.showInformationMessage('No files selected.');
    }
};

export default runFile;
