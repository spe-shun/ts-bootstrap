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
export const isMacOS = os.platform() === 'darwin';
export const isLinux = os.platform() === 'linux';
export const isWSL = os.platform() === 'linux' && os.release().toLowerCase().includes('microsoft');

/**
 * Check if running in PowerShell (improved detection)
 */
export const isPowerShell = () => {
    try {
        // Check environment variables for shell information
        const shell = process.env.SHELL || process.env.ComSpec || '';
        const psModulePath = process.env.PSModulePath;
        const psVersionTable = process.env.PSVersionTable;
        
        return shell.toLowerCase().includes('powershell') || 
               psModulePath !== undefined ||
               psVersionTable !== undefined ||
               process.env.POWERSHELL_DISTRIBUTION_CHANNEL !== undefined;
    } catch (error) {
        return false;
    }
};

/**
 * Check if running in Windows Command Prompt
 */
export const isCmd = () => {
    if (!isWindows) return false;
    const comSpec = process.env.ComSpec || '';
    return comSpec.toLowerCase().includes('cmd.exe') && !isPowerShell();
};

/**
 * Get shell type for better command compatibility
 */
export const getShellType = (): 'powershell' | 'cmd' | 'bash' | 'zsh' | 'fish' | 'unknown' => {
    if (isPowerShell()) return 'powershell';
    if (isCmd()) return 'cmd';
    
    const shell = process.env.SHELL || '';
    if (shell.includes('bash')) return 'bash';
    if (shell.includes('zsh')) return 'zsh';
    if (shell.includes('fish')) return 'fish';
    
    return 'unknown';
};

/**
 * Get path separator based on OS
 */
export const getPathSeparator = () => isWindows ? '\\' : '/';

/**
 * Convert path to OS-specific format
 */
export const normalizePath = (path: string): string => {
    if (isWindows && !isWSL) {
        return path.replace(/\//g, '\\');
    }
    return path.replace(/\\/g, '/');
};

/**
 * Get command separator based on shell type
 */
export const getCommandSeparator = (): string => {
    const shellType = getShellType();
    switch (shellType) {
        case 'powershell':
            return ';';
        case 'cmd':
            return '&';
        default:
            return '&&';
    }
};
