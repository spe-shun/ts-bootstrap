import * as path from 'path';
import * as vscode from 'vscode';
import config from '../config';
import { getWorkSpaceFolderName, isWindows, isPowerShell, normalizePath, isWSL } from '../utils';
import { getNvmUseCommand } from './node-version';

const runFile = async (terminal: vscode.Terminal, nodeVersion?: string) => {
    const activeTextEditor = vscode.window.activeTextEditor;

    if (activeTextEditor) {
        const baseName = activeTextEditor.document.fileName;
        const fileExtension = path.extname(baseName).toLowerCase();
        
        // 根据文件扩展名选择执行器
        let executor = fileExtension === '.js' ? 'node' : 'ts-node';
        let cdCommand = 'cd';
        let pathSeparator = isWindows && !isWSL ? '\\' : '/';
        
        // 处理 nvm 命令
        if (nodeVersion) {
            executor = `${getNvmUseCommand(nodeVersion)} && ${executor}`;
        }

        terminal.show();

        // 规范化文件路径，确保在不同系统下都能正确处理
        const normalizedBaseName = normalizePath(baseName);
        
        if (config.raw.executeInCurrentDirectory) {
            const currPath = getWorkSpaceFolderName();
            if (!currPath) {
                terminal.sendText(`${executor} ${normalizedBaseName}`);
            } else {
                // 处理工作空间路径替换
                const normalizedCurrPath = normalizePath(currPath);
                let relativePath = normalizedBaseName.replace(normalizedCurrPath, '.');
                
                // Windows PowerShell 对路径的特殊处理
                if (isWindows && isPowerShell() && !isWSL) {
                    relativePath = relativePath.replace(/^\.\//, '.\\');
                }
                
                terminal.sendText(`${executor} ${relativePath}`);
            }
        } else {
            // 获取文件所在目录和文件名
            const pathName = path.dirname(normalizedBaseName);
            const fileName = path.basename(normalizedBaseName);
            
            // 根据环境设置正确的文件前缀
            const filePrefix = isWindows && isPowerShell() && !isWSL ? '.\\ ' : './';
            
            // 在 PowerShell 中改进 cd 命令
            if (isWindows && isPowerShell() && !isWSL) {
                terminal.sendText(`${cdCommand} "${pathName}" ; ${executor} ${filePrefix}${fileName}`);
            } else {
                terminal.sendText(`${cdCommand} ${pathName} && ${executor} ${filePrefix}${fileName}`);
            }
        }
    } else {
        vscode.window.showInformationMessage(vscode.l10n.t('file.noFileSelected'));
    }
};

export default runFile;
