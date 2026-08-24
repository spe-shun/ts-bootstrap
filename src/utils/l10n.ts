import * as vscode from 'vscode';
// L10n utility with fallback support
const l10nFallbacks: Record<string, string> = {
    'tsx.notInstalled': 'Running TypeScript files requires tsx. Install it now?',
    'tsx.installButton': 'Install tsx',
    'tsx.installing': 'Installing tsx…',
    'tsx.installCompleted': 'tsx was installed successfully. Continuing with your TypeScript file.',
    'tsx.installFailed':
        'tsx installation failed or could not be verified. Check the installation terminal, or install it manually with: npm install --global tsx@4',
    'tsx.retryButton': 'Retry',
    'tsx.installTerminalName': 'tsx Installation',
    'tsx.unsupportedNodeVersion': 'tsx requires Node.js 18 or later. Select a newer Node.js version.',
    'tsx.debugRuntimeUnavailable': 'Unable to locate the tsx runtime for the selected Node.js environment.',
    'debug.unableToStart': 'Unable to start the debug session.',
    'terminal.debugSessionRunning': 'There is an ongoing Debug session running. Please close it and retry.',
    'file.noFileSelected': 'Open a JavaScript or TypeScript file first.',
    'file.unsupportedType': 'Only JavaScript and TypeScript files can be run.',
    'nodeVersion.selectPlaceholder': 'Select Node.js version',
    'nodeVersion.executableNotFound': 'Unable to locate the selected Node.js executable.',
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
