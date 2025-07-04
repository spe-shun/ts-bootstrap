import * as vscode from 'vscode';
// L10n utility with fallback support
const l10nFallbacks: Record<string, string> = {
    'tsnode.notInstalled':
        'ts-bootstrap extension depends on ts-node. Please install it to run TypeScript files directly.',
    'tsnode.installButton': 'Install ts-node',
    'tsnode.installCompleted': "ts-node installation completed! Please restart VS Code if it doesn't work.",
    'tsnode.installFailed': 'ts-node installation failed. Please install it manually using: npm install -g ts-node',
    'tsnode.installTerminalName': 'ts-node Installation',
    'tsnode.restartSuggestion': 'Please restart VS Code to apply the changes.',
    'tsnode.restartButton': 'Restart VS Code',
    'terminal.unableToCreateDebugTerminal': 'Unable to create JavaScript Debug Terminal.',
    'terminal.unableToCreateTerminal': 'Unable to create Terminal.',
    'terminal.debugSessionRunning': 'There is an ongoing Debug session running. Please close it and retry.',
    'file.noFileSelected': 'No files selected.',
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
