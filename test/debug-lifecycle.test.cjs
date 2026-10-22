const assert = require('node:assert/strict');
const { test, afterEach } = require('node:test');
const fs = require('node:fs');
const path = require('node:path');
const Module = require('node:module');
const { vscode } = require('./vscode-mock.cjs');
const calls = [];
let launch = async () => true;
vscode.debug = {
    startDebugging: async (...args) => {
        calls.push(args);
        return launch();
    },
};
const originalLoad = Module._load;
Module._load = function (request, ...rest) {
    if (request === 'vscode') return vscode;
    return originalLoad.call(this, request, ...rest);
};
const { debugFile, createDebugConfiguration } = require('../out/scripts/debug-file.js');
Module._load = originalLoad;
afterEach(() => {
    calls.length = 0;
    launch = async () => true;
});
const resource = vscode.Uri.file('/project with spaces/example.ts');
const options = {
    nodeExecutable: '/selected node/bin/node',
    tsxRuntime: { loaderFlag: '--import', loaderPath: '/project with spaces/node_modules/tsx/dist/loader.mjs' },
    cwd: '/project with spaces',
    env: { PATH: '/selected node/bin:/usr/bin' },
};
test('standard TS launch uses selected runtime without forced inspector entry stops', async () => {
    assert.equal(await debugFile(resource, 'typescript', options), true);
    const config = calls[0][1];
    assert.equal(config.type, 'pwa-node');
    assert.equal(config.request, 'launch');
    assert.equal(config.runtimeExecutable, options.nodeExecutable);
    assert.equal(config.cwd, options.cwd);
    assert.deepEqual(config.env, options.env);
    assert.equal(config.stopOnEntry, false);
    assert.equal(config.attachSimplePort, undefined);
    assert.equal(config.autoAttachChildProcesses, false);
    assert.deepEqual(config.runtimeArgs, [
        '--import',
        'file:///project%20with%20spaces/node_modules/tsx/dist/loader.mjs',
    ]);
});
test('JS launch also leaves ordinary pause and breakpoint handling to js-debug', () => {
    const config = createDebugConfiguration(vscode.Uri.file('/project/example.js'), 'javascript', '/project');
    assert.equal(config.stopOnEntry, false);
    assert.equal(config.attachSimplePort, undefined);
    assert.equal(config.runtimeArgs, undefined);
});
test('missing TS runtime does not start a session', async () => {
    assert.equal(await debugFile(resource, 'typescript'), false);
    assert.equal(calls.length, 0);
});
test('launch false/cancellation allows a later launch', async () => {
    launch = async () => false;
    assert.equal(await debugFile(resource, 'typescript', options), false);
    launch = async () => true;
    assert.equal(await debugFile(resource, 'typescript', options), true);
});
test('launch errors propagate and do not poison the next launch', async () => {
    launch = async () => {
        throw new Error('launch unavailable');
    };
    await assert.rejects(debugFile(resource, 'typescript', options), /launch unavailable/);
    launch = async () => true;
    assert.equal(await debugFile(resource, 'typescript', options), true);
});
test('extension never installs a stop-event interceptor or private CDP workaround', () => {
    const debugSource = fs.readFileSync(path.join(__dirname, '../src/scripts/debug-file.ts'), 'utf8');
    const extensionSource = fs.readFileSync(path.join(__dirname, '../src/extension.ts'), 'utf8');
    assert.doesNotMatch(debugSource, /customRequest|requestCDPProxy|NodeWorker\.|WebSocket/);
    assert.doesNotMatch(
        extensionSource,
        /registerDebugAdapterTrackerFactory|onDidStartDebugSession|onDidTerminateDebugSession/,
    );
});
