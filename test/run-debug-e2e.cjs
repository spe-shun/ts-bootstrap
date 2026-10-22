// Real desktop tests. Uses a disposable VS Code profile, never the user's profile.
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
const { runTests } = require('@vscode/test-electron');

function findVSCode() {
    if (process.env.TS_BOOTSTRAP_E2E_VSCODE) return process.env.TS_BOOTSTRAP_E2E_VSCODE;
    const candidates =
        process.platform === 'darwin'
            ? ['/Applications/Visual Studio Code.app/Contents/MacOS/Code']
            : process.platform === 'win32'
              ? [path.join(process.env.LOCALAPPDATA || '', 'Programs/Microsoft VS Code/Code.exe')]
              : ['/usr/share/code/code', '/usr/bin/code'];
    const executable = candidates.find(candidate => fs.existsSync(candidate));
    if (!executable) throw new Error('Set TS_BOOTSTRAP_E2E_VSCODE to an installed VS Code executable.');
    return executable;
}

function installLocalTsx(workspace) {
    const candidates = [process.env.TS_BOOTSTRAP_E2E_TSX, '/opt/homebrew/lib/node_modules/tsx'].filter(Boolean);
    const source = candidates.find(candidate => fs.existsSync(path.join(candidate, 'package.json')));
    if (source) {
        fs.mkdirSync(path.join(workspace, 'node_modules'), { recursive: true });
        fs.symlinkSync(
            source,
            path.join(workspace, 'node_modules/tsx'),
            process.platform === 'win32' ? 'junction' : 'dir',
        );
    } else {
        execFileSync(
            process.platform === 'win32' ? 'npm.cmd' : 'npm',
            ['install', '--prefix', workspace, '--no-audit', '--no-fund', '--ignore-scripts=false', 'tsx@4'],
            { stdio: 'inherit' },
        );
    }
}

async function main() {
    const extensionDevelopmentPath = path.resolve(__dirname, '..');
    if (!fs.existsSync(path.join(extensionDevelopmentPath, 'dist/extension.js'))) {
        throw new Error('Build the extension before running real debug E2E tests (yarn package).');
    }
    // Keep the profile short enough for macOS's Unix-domain socket path limit.
    // Canonical paths also avoid /var -> /private/var aliases mismatching TS source maps.
    const root = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'tsb-')));
    const workspace = path.join(root, 'workspace with spaces');
    fs.mkdirSync(path.join(workspace, '.vscode'), { recursive: true });
    fs.writeFileSync(path.join(workspace, 'package.json'), JSON.stringify({ private: true, type: 'module' }));
    fs.writeFileSync(
        path.join(workspace, '.vscode/settings.json'),
        JSON.stringify(
            {
                'ts-bootstrap.debugConsole': 'internalConsole',
                'debug.showBreakpointsInOverviewRuler': false,
                'security.workspace.trust.enabled': false,
                'extensions.autoCheckUpdates': false,
                'extensions.autoUpdate': false,
            },
            null,
            2,
        ),
    );
    installLocalTsx(workspace);
    const resultPath = path.join(root, 'result.json');
    const nodeExecutable = process.env.TS_BOOTSTRAP_E2E_NODE || process.execPath;
    console.log(`Real VS Code debug E2E artifacts: ${root}`);
    console.log(`Node on test PATH: ${nodeExecutable}`);
    try {
        await runTests({
            vscodeExecutablePath: findVSCode(),
            extensionDevelopmentPath,
            extensionTestsPath: path.join(__dirname, 'debug-e2e.cjs'),
            extensionTestsEnv: {
                TS_BOOTSTRAP_E2E_ROOT: root,
                TS_BOOTSTRAP_E2E_NODE: nodeExecutable,
                PATH: [path.dirname(nodeExecutable), process.env.PATH].filter(Boolean).join(path.delimiter),
            },
            launchArgs: [
                workspace,
                '--user-data-dir',
                path.join(root, 'profile'),
                '--extensions-dir',
                path.join(root, 'extensions'),
                '--disable-extensions',
                '--disable-workspace-trust',
                '--skip-welcome',
                '--skip-release-notes',
            ],
        });
    } finally {
        if (fs.existsSync(resultPath)) {
            const result = JSON.parse(fs.readFileSync(resultPath, 'utf8'));
            console.log(
                JSON.stringify(
                    {
                        vscode: result.vscode,
                        passed: result.passed,
                        cases: result.cases.map(item => ({
                            name: item.name,
                            passed: item.passed,
                            actualRuntime: item.actualRuntime,
                            error: item.error,
                        })),
                        error: result.error,
                    },
                    null,
                    2,
                ),
            );
        }
        console.log(`E2E result: ${resultPath}`);
    }
}

main().catch(error => {
    console.error(error);
    process.exitCode = 1;
});
