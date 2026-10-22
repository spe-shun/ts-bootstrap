import * as assert from 'assert';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';

// You can import and use all API from the 'vscode' module
// as well as import your extension to test it
import * as vscode from 'vscode';
import { getTsxDebugRuntime, getTsxLoaderFlag, isTsxNodeVersionSupported } from '../../scripts/check-tsx';
import { createDebugConfiguration, DEBUG_SESSION_MARKER } from '../../scripts/debug-file';
import { getFileExecutor, getFileRuntime } from '../../scripts/run-files';
// import * as myExtension from '../../extension';

suite('Extension Test Suite', () => {
    vscode.window.showInformationMessage('Start all tests.');

    test('Sample test', () => {
        assert.strictEqual(-1, [1, 2, 3].indexOf(5));
        assert.strictEqual(-1, [1, 2, 3].indexOf(0));
    });

    test('Should select a runtime only for supported file types', () => {
        assert.strictEqual(getFileRuntime('/workspace/example.js'), 'javascript');
        assert.strictEqual(getFileRuntime('/workspace/example.mjs'), 'javascript');
        assert.strictEqual(getFileRuntime('/workspace/example.ts'), 'typescript');
        assert.strictEqual(getFileRuntime('/workspace/example.cts'), 'typescript');
        assert.strictEqual(getFileRuntime('/workspace/example.tsx'), undefined);
        assert.strictEqual(getFileRuntime('/workspace/example.json'), undefined);
    });

    test('Should execute JavaScript with node and TypeScript with tsx', () => {
        assert.strictEqual(getFileExecutor('javascript'), 'node');
        assert.strictEqual(getFileExecutor('typescript'), 'tsx');
    });

    test('Should require a tsx-compatible Node.js version', () => {
        assert.strictEqual(isTsxNodeVersionSupported(), true);
        assert.strictEqual(isTsxNodeVersionSupported('17.9.1'), false);
        assert.strictEqual(isTsxNodeVersionSupported('18.0.0'), true);
        assert.strictEqual(isTsxNodeVersionSupported('24.16.0'), true);
    });

    test('Should use the loader mode supported by the selected Node.js version', () => {
        assert.strictEqual(getTsxLoaderFlag('18.18.2'), '--loader');
        assert.strictEqual(getTsxLoaderFlag('18.19.0'), '--import');
        assert.strictEqual(getTsxLoaderFlag('19.9.0'), '--loader');
        assert.strictEqual(getTsxLoaderFlag('20.5.1'), '--loader');
        assert.strictEqual(getTsxLoaderFlag('20.6.0'), '--import');
        assert.strictEqual(getTsxLoaderFlag('24.16.0'), '--import');
    });

    test('Should resolve tsx directly from the selected nvm installation', async () => {
        const nvmDirectory = fs.mkdtempSync(path.join(os.tmpdir(), 'ts-bootstrap-nvm-'));
        const versionDirectory = path.join(nvmDirectory, 'versions', 'node', 'v20.20.2');
        const nodeExecutable = path.join(versionDirectory, 'bin', 'node');
        const loaderPath = path.join(versionDirectory, 'lib', 'node_modules', 'tsx', 'dist', 'loader.mjs');

        fs.mkdirSync(path.dirname(nodeExecutable), { recursive: true });
        fs.mkdirSync(path.dirname(loaderPath), { recursive: true });
        fs.writeFileSync(nodeExecutable, '');
        fs.writeFileSync(loaderPath, '');

        try {
            const runtime = await getTsxDebugRuntime('20.20.2', nodeExecutable);

            assert.deepStrictEqual(runtime, {
                loaderPath,
                loaderFlag: '--import',
                nodeVersion: '20.20.2',
            });
        } finally {
            fs.rmSync(nvmDirectory, { recursive: true, force: true });
        }
    });

    test('Should launch TypeScript directly without attaching to tsx child processes', () => {
        const resource = vscode.Uri.file('/workspace/example.ts');
        const configuration = createDebugConfiguration(resource, 'typescript', '/workspace', {
            nodeExecutable: '/nvm/versions/node/v20.20.2/bin/node',
            tsxRuntime: {
                loaderPath: '/global/node_modules/tsx/dist/loader.mjs',
                loaderFlag: '--import',
                nodeVersion: '20.20.2',
            },
        });

        assert.ok(configuration);
        assert.strictEqual(configuration.type, 'pwa-node');
        assert.strictEqual(configuration[DEBUG_SESSION_MARKER], true);
        assert.strictEqual(configuration.program, resource.fsPath);
        assert.strictEqual(configuration.runtimeExecutable, '/nvm/versions/node/v20.20.2/bin/node');
        assert.strictEqual(configuration.runtimeVersion, undefined);
        assert.strictEqual(configuration.autoAttachChildProcesses, false);
        assert.strictEqual(configuration.attachSimplePort, undefined);
        assert.strictEqual(configuration.stopOnEntry, false);
        assert.deepStrictEqual(configuration.runtimeArgs, [
            '--import',
            'file:///global/node_modules/tsx/dist/loader.mjs',
        ]);
    });

    test('Should launch JavaScript without tsx runtime arguments', () => {
        const resource = vscode.Uri.file('/workspace/example.js');
        const configuration = createDebugConfiguration(resource, 'javascript', '/workspace');

        assert.ok(configuration);
        assert.strictEqual(configuration.program, resource.fsPath);
        assert.strictEqual(configuration.runtimeArgs, undefined);
        assert.strictEqual(configuration[DEBUG_SESSION_MARKER], true);
        assert.strictEqual(configuration.autoAttachChildProcesses, false);
        assert.strictEqual(configuration.attachSimplePort, undefined);
        assert.strictEqual(configuration.stopOnEntry, false);
    });
});
