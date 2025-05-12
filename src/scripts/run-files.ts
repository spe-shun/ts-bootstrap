import * as path from 'path';
import * as vscode from 'vscode';
import config from '../config';
import { getWorkSpaceFolderName } from '../utils';

const runFile = async (terminal: vscode.Terminal) => {
    const activeTextEditor = vscode.window.activeTextEditor;

    if (activeTextEditor) {
        const baseName = activeTextEditor.document.fileName;
        const fileExtension = path.extname(baseName).toLowerCase();
        
        // 根据文件扩展名选择执行器
        const executor = fileExtension === '.js' ? 'node' : 'ts-node';

        terminal.show();

        if (config.raw.executeInCurrentDirectory) {
            const currPath = getWorkSpaceFolderName();
            if (!currPath) {
                terminal.sendText(`${executor} ${baseName}`);
            } else {
                terminal.sendText(`${executor} ${baseName.replace(currPath, '.')}`);
            }
        } else {
            const pathName = path.dirname(baseName);
            const fileName = path.basename(baseName);
            terminal.sendText(`cd ${pathName} && ${executor} ./${fileName}`);
        }
    } else {
        vscode.window.showInformationMessage('No files selected.');
    }
};

export default runFile;
