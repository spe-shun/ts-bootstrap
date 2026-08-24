import * as fs from 'fs';
import * as path from 'path';

import { downloadAndUnzipVSCode, runTests } from '@vscode/test-electron';

function resolveExecutablePath(downloadedPath: string): string {
    if (fs.existsSync(downloadedPath) || process.platform !== 'darwin') {
        return downloadedPath;
    }

    const currentMacOSExecutable = path.join(path.dirname(downloadedPath), 'Code');
    return fs.existsSync(currentMacOSExecutable) ? currentMacOSExecutable : downloadedPath;
}

async function main() {
    try {
        // The folder containing the Extension Manifest package.json
        // Passed to `--extensionDevelopmentPath`
        const extensionDevelopmentPath = path.resolve(__dirname, '../../');

        // The path to test runner
        // Passed to --extensionTestsPath
        const extensionTestsPath = path.resolve(__dirname, './suite/index');

        // Download VS Code, then account for both legacy and current macOS executable names.
        const downloadedPath = await downloadAndUnzipVSCode();
        const vscodeExecutablePath = resolveExecutablePath(downloadedPath);

        await runTests({ vscodeExecutablePath, extensionDevelopmentPath, extensionTestsPath });
    } catch (err) {
        console.error('Failed to run tests', err);
        process.exit(1);
    }
}

main();
