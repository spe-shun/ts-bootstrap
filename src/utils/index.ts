import * as vscode from 'vscode';
import * as os from 'os';

export const getWorkSpaceFolderName = () => {
    const workspaceFolders = vscode.workspace.workspaceFolders;
    if (workspaceFolders?.length !== 1) {
        return null;
    }
    return workspaceFolders[0].uri.path;
};

/**
 * Check current operating system
 */
export const isWindows = os.platform() === 'win32';
export const isWSL = os.platform() === 'linux' && os.release().toLowerCase().includes('microsoft');

/**
 * Check if running in PowerShell
 */
export const isPowerShell = () => {
    try {
        // Check environment variables for shell information
        const shell = process.env.SHELL || process.env.ComSpec || '';
        return shell.toLowerCase().includes('powershell') || process.env.PSModulePath !== undefined;
    } catch (error) {
        return false;
    }
};

/**
 * Get path separator based on OS
 */
export const getPathSeparator = () => isWindows ? '\\' : '/';

/**
 * Convert path to OS-specific format
 */
export const normalizePath = (path: string): string => {
    return isWindows ? path.replace(/\//g, '\\') : path.replace(/\\/g, '/');
};
