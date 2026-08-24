import * as vscode from 'vscode';
// L10n utility with fallback support
const l10nFallbacks: Record<string, string> = {
    'tsnode.notInstalled': 'Running TypeScript files requires ts-node. Install it now?',
    'tsnode.installButton': 'Install ts-node',
    'tsnode.installing': 'Installing ts-node…',
    'tsnode.installCompleted': 'ts-node was installed successfully. Continuing with your TypeScript file.',
    'tsnode.installFailed':
        'ts-node installation failed. Check the installation terminal, or install it manually with: npm install --global ts-node',
    'tsnode.retryButton': 'Retry',
    'tsnode.installTerminalName': 'ts-node Installation',
    'terminal.unableToCreateDebugTerminal': 'Unable to create JavaScript Debug Terminal.',
    'terminal.debugSessionRunning': 'There is an ongoing Debug session running. Please close it and retry.',
    'file.noFileSelected': 'Open a JavaScript or TypeScript file first.',
    'file.unsupportedType': 'Only JavaScript and TypeScript files can be run.',
    'nodeVersion.selectPlaceholder': 'Select Node.js version',
    'nodeVersion.getVersionsFailed': 'Failed to get Node.js versions.',
    'nodeVersion.nvmNotInstalled.windows': 'Failed to get Node.js versions. Please ensure nvm-windows is installed.',
    'nodeVersion.nvmNotInstalled.unix': 'Failed to get Node.js versions. Please ensure nvm is installed.',
};

/**
 * Enhanced l10n function with fallback support for English locale
 * This addresses the VS Code issue where bundle.l10n.json isn't loaded in English environments
 */
export function t(key: string, ...args: Array<string | number | boolean>): string {
    try {
        const translated = vscode.l10n.t(key, ...args);

        // If the translation returns the key itself, use fallback
        if (translated === key && l10nFallbacks[key]) {
            return l10nFallbacks[key];
        }

        return translated;
    } catch (error) {
        // If l10n fails, use fallback
        return l10nFallbacks[key] || key;
    }
}
