const assert = require('node:assert/strict');
const { test, beforeEach, afterEach } = require('node:test');
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
const getConfiguration = vscode.workspace.getConfiguration;
const consoleSettings = new Map();
const configurationReads = [];
beforeEach(() => {
    vscode.workspace.getConfiguration = (section, target) => ({
        get: key => {
            if (key === 'debugConsole') {
                configurationReads.push({ section, target });
                return consoleSettings.get(target.toString());
            }
            return getConfiguration(section, target).get(key);
        },
    });
});
afterEach(() => {
    calls.length = 0;
    launch = async () => true;
    consoleSettings.clear();
    configurationReads.length = 0;
    vscode.workspace.getConfiguration = getConfiguration;
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
    assert.equal(config.name, 'TS/JS Debugger: example.ts');
    assert.equal(config.program, resource.fsPath);
    assert.equal(config.console, 'internalConsole');
    assert.equal(config.internalConsoleOptions, 'openOnSessionStart');
    assert.equal(config.outputCapture, 'std');
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
test('interactive debugging uses the target file setting without duplicate std capture', async () => {
    consoleSettings.set(resource.toString(), 'integratedTerminal');
    assert.equal(await debugFile(resource, 'typescript', options), true);
    const config = calls[0][1];
    assert.equal(config.console, 'integratedTerminal');
    assert.equal(config.internalConsoleOptions, 'neverOpen');
    assert.equal(config.outputCapture, undefined);
    assert.equal(config.runtimeExecutable, options.nodeExecutable);
    assert.equal(config.cwd, options.cwd);
    assert.deepEqual(config.env, options.env);
    assert.equal(config.stopOnEntry, false);
    assert.deepEqual(configurationReads, [{ section: 'ts-bootstrap', target: resource }]);
});
test('console selection follows each resource and falls back to the Debug Console', () => {
    const terminalFile = vscode.Uri.file('/interactive/input.js');
    const defaultFile = vscode.Uri.file('/scripts/output.js');
    consoleSettings.set(terminalFile.toString(), 'integratedTerminal');
    assert.equal(createDebugConfiguration(terminalFile, 'javascript', '/interactive').console, 'integratedTerminal');
    const fallback = createDebugConfiguration(defaultFile, 'javascript', '/scripts');
    assert.equal(fallback.name, 'TS/JS Debugger: output.js');
    assert.equal(fallback.console, 'internalConsole');
    consoleSettings.set(defaultFile.toString(), 'internalConsole');
    assert.equal(createDebugConfiguration(defaultFile, 'javascript', '/scripts').console, 'internalConsole');
    consoleSettings.set(defaultFile.toString(), 'invalid');
    assert.equal(createDebugConfiguration(defaultFile, 'javascript', '/scripts').console, 'internalConsole');
    consoleSettings.delete(terminalFile.toString());
    assert.equal(createDebugConfiguration(terminalFile, 'javascript', '/interactive').console, 'internalConsole');
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
