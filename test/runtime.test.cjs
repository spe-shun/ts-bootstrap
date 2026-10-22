const assert = require('node:assert/strict');
const { test, beforeEach, afterEach } = require('node:test');
const Module = require('node:module');
const path = require('node:path');
const os = require('node:os');
const fs = require('node:fs');
const { pathToFileURL } = require('node:url');
const { vscode, state, emitEnd } = require('./vscode-mock.cjs');
const original = Module._load;
Module._load = function (request, ...rest) {
    return request === 'vscode' ? vscode : original.call(this, request, ...rest);
};
const { createExecutionPlan, getExecutionDirectory, FileTaskRunner } = require('../out/scripts/run-files');
const { createDebugConfiguration } = require('../out/scripts/debug-file');
const { resolveTsxLoaderPath, getTsxDebugRuntime } = require('../out/scripts/check-tsx');
Module._load = original;
beforeEach(() => {
    state.folder = { uri: vscode.Uri.file('/work') };
});
afterEach(() => {
    state.tasks.length = 0;
    state.configuration = true;
    state.folder = undefined;
});
function plan(file = '/work/a.ts') {
    return createExecutionPlan(vscode.Uri.file(file), 'typescript', '/node dir/node', {
        loaderPath: '/tsx dir/loader.mjs',
        loaderFlag: '--import',
        nodeVersion: '22.12.0',
    });
}
test('Run and Debug share node, loader URL, cwd and env; metacharacters remain arguments', () => {
    const p = plan('/work/a space & ; $ " \' .ts');
    const debug = createDebugConfiguration(p.resource, p.runtime, p.cwd, p);
    assert.equal(debug.runtimeExecutable, p.nodeExecutable);
    assert.deepEqual([...debug.runtimeArgs, debug.program], p.args);
    assert.equal(debug.cwd, p.cwd);
    assert.deepEqual(debug.env, p.env);
    assert.equal(p.args[1], pathToFileURL('/tsx dir/loader.mjs').toString());
    assert.equal(p.args.at(-1), p.resource.fsPath);
    const key = Object.keys(p.env).find(k => k.toLowerCase() === 'path');
    assert.equal(p.env[key].split(path.delimiter)[0], '/node dir');
});
test('cwd uses target resource folder settings and no-workspace fallback', () => {
    const file = vscode.Uri.file('/workspace/nested/test.ts');
    state.folder = { uri: vscode.Uri.file('/workspace') };
    assert.equal(getExecutionDirectory(file), '/workspace');
    assert.equal(state.configResource, file);
    state.configuration = false;
    assert.equal(getExecutionDirectory(file), '/workspace/nested');
    state.configuration = true;
    state.folder = undefined;
    assert.equal(getExecutionDirectory(file), '/workspace/nested');
});
test('local tsx wins over selected global; nearest ancestor and removal are respected', async () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'tsx local '));
    const loader = base => path.join(base, 'node_modules/tsx/dist/loader.mjs');
    const write = file => {
        fs.mkdirSync(path.dirname(file), { recursive: true });
        fs.writeFileSync(file, '');
    };
    try {
        const local = loader(path.join(root, 'project'));
        const global = loader(path.join(root, 'node'));
        write(local);
        write(global);
        const resource = vscode.Uri.file(path.join(root, 'project/src/a.ts'));
        const node = path.join(root, 'node/node');
        assert.equal(resolveTsxLoaderPath(node, resource), local);
        assert.equal((await getTsxDebugRuntime('22.12.0', node, resource)).loaderPath, local);
        fs.unlinkSync(local);
        assert.equal((await getTsxDebugRuntime('22.12.0', node, resource)).loaderPath, global);
    } finally {
        fs.rmSync(root, { recursive: true, force: true });
    }
});
test('different files coexist; rerun stops only the same owned task, never named terminals', async () => {
    const runner = new FileTaskRunner();
    try {
        await runner.run(plan('/work/a.ts'));
        await runner.run(plan('/work/b.ts'));
        const [a, b] = state.tasks;
        assert.equal(a.terminated, false);
        assert.equal(b.terminated, false);
        await runner.run(plan('/work/a.ts'));
        assert.equal(a.terminated, true);
        assert.equal(b.terminated, false);
        assert.equal(state.tasks.length, 3);
        assert.ok(state.tasks[2].task.execution instanceof vscode.ProcessExecution);
        emitEnd(b);
        await runner.run(plan('/work/b.ts'));
        assert.equal(b.terminated, false);
    } finally {
        runner.dispose();
    }
});
test('rapid repeated runs serialize and disposal does not launch queued work', async () => {
    const runner = new FileTaskRunner();
    await Promise.all([runner.run(plan()), runner.run(plan()), runner.run(plan())]);
    assert.equal(state.tasks.length, 3);
    assert.deepEqual(
        state.tasks.map(x => x.terminated),
        [true, true, false],
    );
    runner.dispose();
    await runner.run(plan());
    assert.equal(state.tasks.length, 3);
});

test('task ending before executeTask resolves is not retained as a live run', async () => {
    const runner = new FileTaskRunner();
    const execute = vscode.tasks.executeTask;
    vscode.tasks.executeTask = async task => {
        const execution = await execute(task);
        emitEnd(execution);
        return execution;
    };
    try {
        await runner.run(plan());
        await runner.run(plan());
        assert.equal(state.tasks.length, 2);
        assert.equal(state.tasks[0].terminated, false);
    } finally {
        vscode.tasks.executeTask = execute;
        runner.dispose();
    }
});

test('tsx installation uses selected absolute Node and npm CLI as process arguments', () => {
    const { createInstallationTask } = require('../out/scripts/check-tsx');
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'npm cli & '));
    try {
        const node = path.join(root, 'node');
        const cli = path.join(root, 'node_modules/npm/bin/npm-cli.js');
        fs.mkdirSync(path.dirname(cli), { recursive: true });
        fs.writeFileSync(cli, '');
        const task = createInstallationTask(vscode.Uri.file('/work/a.ts'), 7, node);
        assert.ok(task.execution instanceof vscode.ProcessExecution);
        assert.equal(task.execution.process, node);
        assert.deepEqual(task.execution.args, [cli, 'install', '--global', 'tsx@4']);
        fs.unlinkSync(cli);
        assert.equal(createInstallationTask(vscode.Uri.file('/work/a.ts'), 8, node), undefined);
    } finally {
        fs.rmSync(root, { recursive: true, force: true });
    }
});

test('standalone files use direct Node terminals without unsupported global tasks', async () => {
    state.folder = undefined;
    const terminals = [];
    const create = vscode.window.createTerminal;
    vscode.window.createTerminal = options => {
        const terminal = create(options);
        terminals.push(terminal);
        return terminal;
    };
    const runner = new FileTaskRunner();
    try {
        await runner.run(plan('/standalone/a.ts'));
        await runner.run(plan('/standalone/b.ts'));
        await runner.run(plan('/standalone/a.ts'));
        assert.equal(state.tasks.length, 0);
        assert.equal(terminals[0].disposed, true);
        assert.equal(terminals[1].disposed, undefined);
        assert.equal(terminals[2].options.shellPath, '/node dir/node');
        assert.deepEqual(terminals[2].options.shellArgs.slice(3), plan('/standalone/a.ts').args);
        assert.equal(terminals[2].options.shellArgs[0], '-e');
        assert.equal(terminals[2].options.strictEnv, undefined);
    } finally {
        runner.dispose();
        vscode.window.createTerminal = create;
    }
});

test('different source folders share one global installation prompt for the same Node', async () => {
    const childProcess = require('node:child_process');
    const { ensureTsxInstallation } = require('../out/scripts/check-tsx');
    const execute = childProcess.execFile;
    const warning = vscode.window.showWarningMessage;
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'tsx install lock '));
    let prompts = 0;
    let cancel;
    childProcess.execFile = (_file, _args, _options, callback) => {
        callback(null, 'v22.12.0');
    };
    vscode.window.showWarningMessage = () => {
        prompts++;
        return new Promise(resolve => {
            cancel = resolve;
        });
    };
    const oldPath = process.env.PATH;
    process.env.PATH = '';
    try {
        const node = path.join(root, 'bin/node');
        const a = ensureTsxInstallation(vscode.Uri.file(path.join(root, 'one/a.ts')), undefined, node);
        const b = ensureTsxInstallation(vscode.Uri.file(path.join(root, 'two/b.ts')), undefined, node);
        await new Promise(resolve => setImmediate(resolve));
        assert.equal(prompts, 1);
        cancel(undefined);
        assert.deepEqual(await Promise.all([a, b]), [false, false]);
    } finally {
        process.env.PATH = oldPath;
        childProcess.execFile = execute;
        vscode.window.showWarningMessage = warning;
        fs.rmSync(root, { recursive: true, force: true });
    }
});

test('standalone wrapper executes real Node args and retains output until input', async () => {
    const { spawn } = require('node:child_process');
    const { STANDALONE_RUNNER } = require('../out/scripts/run-files');
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'standalone ; '));
    const script = path.join(root, 'a & quote ".js');
    fs.writeFileSync(script, 'console.log("target-output"); process.exitCode = 3;');
    const child = spawn(process.execPath, ['-e', STANDALONE_RUNNER, '--', script], { stdio: ['pipe', 'pipe', 'pipe'] });
    let output = '';
    try {
        await new Promise((resolve, reject) => {
            const timer = setTimeout(() => reject(new Error('wrapper output timeout')), 3000);
            child.once('error', reject);
            child.stdout.on('data', data => {
                output += data;
                if (output.includes('Press Enter to close.')) {
                    clearTimeout(timer);
                    resolve();
                }
            });
        });
        assert.match(output, /target-output/);
        assert.match(output, /Exit code: 3/);
        assert.equal(child.exitCode, null);
        const ended = new Promise(resolve => child.once('exit', resolve));
        child.stdin.write('\n');
        assert.equal(await ended, 3);
    } finally {
        child.kill();
        fs.rmSync(root, { recursive: true, force: true });
    }
});

test('execution plan passes only PATH delta, never inherited secret or extension-host values', () => {
    const key = 'TS_BOOTSTRAP_TEST_SECRET';
    const old = process.env[key];
    process.env[key] = 'synthetic-test-marker-not-a-real-secret';
    try {
        const p = plan();
        assert.deepEqual(
            Object.keys(p.env).map(k => k.toLowerCase()),
            ['path'],
        );
        assert.equal(p.env[key], undefined);
        const debug = createDebugConfiguration(p.resource, p.runtime, p.cwd, p);
        assert.ok(!JSON.stringify(debug).includes(process.env[key]));
    } finally {
        if (old === undefined) delete process.env[key];
        else process.env[key] = old;
    }
});

test('matching inherited Node PATH requires no environment serialization', () => {
    const key = Object.keys(process.env).find(k => k.toLowerCase() === 'path') ?? 'PATH';
    const old = process.env[key];
    process.env[key] = ['/node dir', '/other/bin'].join(path.delimiter);
    try {
        assert.deepEqual(plan().env, {});
    } finally {
        if (old === undefined) delete process.env[key];
        else process.env[key] = old;
    }
});
