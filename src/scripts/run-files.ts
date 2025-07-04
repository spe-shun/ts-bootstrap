import * as path from 'path';
import * as vscode from 'vscode';
import config from '../config';
import { getWorkSpaceFolderName, isWindows, normalizePath, isWSL, getCommandSeparator, getShellType } from '../utils';
import { t } from '../utils/l10n';
import { getNvmUseCommand } from './node-version';

const runFile = async (terminal: vscode.Terminal, isDebug: boolean, nodeVersion?: string) => {
    const activeTextEditor = vscode.window.activeTextEditor;

    if (activeTextEditor) {
        const baseName = activeTextEditor.document.fileName;
        const fileExtension = path.extname(baseName).toLowerCase();

        // Choose executor based on file extension
        let executor = fileExtension === '.js' ? 'node' : 'ts-node';
        const shellType = getShellType();
        const commandSeparator = getCommandSeparator();

        // Handle nvm command
        if (nodeVersion) {
            executor = `${getNvmUseCommand(nodeVersion, isDebug)} ${commandSeparator} ${executor}`;
        }

        terminal.show();

        // Normalize file path to ensure correct handling across different systems
        const normalizedBaseName = normalizePath(baseName);

        if (config.raw.executeInCurrentDirectory) {
            const currPath = getWorkSpaceFolderName();
            if (!currPath) {
                terminal.sendText(`${executor} "${normalizedBaseName}"`);
            } else {
                // Handle workspace path replacement
                const normalizedCurrPath = normalizePath(currPath);
                let relativePath = normalizedBaseName.replace(normalizedCurrPath, '.');

                // Ensure proper path format for different shells
                if (isWindows && !isWSL) {
                    if (shellType === 'powershell') {
                        relativePath = relativePath.replace(/^\.\//, '.\\');
                    } else if (shellType === 'cmd') {
                        relativePath = relativePath.replace(/^\.\//, '.\\');
                    }
                }

                terminal.sendText(`${executor} "${relativePath}"`);
            }
        } else {
            // Get directory and filename
            const pathName = path.dirname(normalizedBaseName);
            const fileName = path.basename(normalizedBaseName);

            // Use quotes to handle paths with spaces
            if (shellType === 'powershell') {
                terminal.sendText(`cd "${pathName}" ${commandSeparator} ${executor} ".\\${fileName}"`);
            } else if (shellType === 'cmd') {
                terminal.sendText(`cd /d "${pathName}" ${commandSeparator} ${executor} ".\\${fileName}"`);
            } else {
                // Unix-like shells (bash, zsh, fish, etc.)
                terminal.sendText(`cd "${pathName}" ${commandSeparator} ${executor} "./${fileName}"`);
            }
        }
    } else {
        vscode.window.showInformationMessage(t('file.noFileSelected'));
    }
};

export default runFile;
