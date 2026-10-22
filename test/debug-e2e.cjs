// Runs inside an isolated real VS Code Extension Development Host.
// A test-only tracker observes pauses; production code never intercepts them.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vscode = require('vscode');

const root = process.env.TS_BOOTSTRAP_E2E_ROOT;
const report = { vscode: vscode.version, cases: [], passed: false };
const pause = ms => new Promise(resolve => setTimeout(resolve, ms));
let current;

async function waitFor(predicate, label, timeout = 20000) {
    const until = Date.now() + timeout;
    do {
        const value = predicate();
        if (value) return value;
        await pause(40);
    } while (Date.now() < until);
    throw new Error(`Timed out: ${label}`);
}

function alive(pid) {
    try {
        process.kill(pid, 0);
        return true;
    } catch (error) {
        if (error.code === 'ESRCH') return false;
        throw error;
    }
}

function canonical(file) {
    return fs.realpathSync(file);
}

function script(name, contents) {
    const file = path.join(vscode.workspace.workspaceFolders[0].uri.fsPath, 'source files', name);
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, contents);
    return file;
}

async function launch(file, consoleMode = 'internalConsole') {
    const uri = vscode.Uri.file(file);
    await vscode.workspace
        .getConfiguration('ts-bootstrap', uri)
        .update('debugConsole', consoleMode, vscode.ConfigurationTarget.WorkspaceFolder);
    await vscode.window.showTextDocument(await vscode.workspace.openTextDocument(uri));
    const entry = current;
    await vscode.commands.executeCommand('extension.ts-bootstrap.debugTerminal');
    const session = await waitFor(
        () => entry.sessions.find(item => item.configuration.__tsBootstrapDebug),
        'extension debug session',
    );
    entry.configuration = {
        console: session.configuration.console,
        runtimeExecutable: session.configuration.runtimeExecutable,
        runtimeArgs: session.configuration.runtimeArgs,
        program: session.configuration.program,
        cwd: session.configuration.cwd,
        outputCapture: session.configuration.outputCapture,
        stopOnEntry: session.configuration.stopOnEntry,
    };
    assert.equal(session.configuration.console, consoleMode);
    assert.equal(session.configuration.stopOnEntry, false);
    assert.equal(canonical(session.configuration.runtimeExecutable), canonical(process.env.TS_BOOTSTRAP_E2E_NODE));
    if (file.endsWith('.ts')) {
        assert.match(session.configuration.runtimeArgs[1], /workspace%20with%20spaces\/node_modules\/tsx\//);
    } else {
        assert.deepEqual(session.configuration.runtimeArgs || [], [], 'JS does not require a tsx loader');
    }
    return session;
}

async function ended(entry = current) {
    await waitFor(
        () => entry.sessions.length && entry.sessions.every(session => entry.terminated.includes(session.id)),
        'debug session termination',
    );
}

async function runCase(name, fn) {
    current = {
        name,
        sessions: [],
        terminated: [],
        stops: [],
        outputs: [],
        breakpointEvents: [],
        requests: [],
        passed: false,
    };
    const entry = current;
    report.cases.push(entry);
    try {
        await fn(entry);
        entry.passed = true;
        console.log(`PASS ${name}`);
    } catch (error) {
        entry.error = error.stack || String(error);
        console.error(`FAIL ${name}: ${entry.error}`);
        throw error;
    } finally {
        for (const session of entry.sessions) {
            if (!entry.terminated.includes(session.id)) await vscode.debug.stopDebugging(session);
        }
        vscode.debug.removeBreakpoints(vscode.debug.breakpoints);
        // Do not serialize DebugSession's cyclic objects or inherited environment.
        entry.sessions = entry.sessions.map(session => ({ id: session.id, type: session.type, name: session.name }));
        current = undefined;
    }
}

exports.run = async () => {
    const subscriptions = [];
    try {
        assert.ok(root, 'Run through test/run-debug-e2e.cjs');
        // macOS VS Code may resolve a login-shell environment after startup;
        // apply the requested test runtime inside this disposable host as well.
        process.env.PATH = [path.dirname(process.env.TS_BOOTSTRAP_E2E_NODE), process.env.PATH].join(path.delimiter);
        const extension = vscode.extensions.getExtension('spe-shun.ts-bootstrap');
        assert.ok(extension, 'development extension found');
        await extension.activate();
        subscriptions.push(vscode.debug.onDidStartDebugSession(session => current?.sessions.push(session)));
        subscriptions.push(vscode.debug.onDidTerminateDebugSession(session => current?.terminated.push(session.id)));
        subscriptions.push(
            vscode.debug.registerDebugAdapterTrackerFactory('*', {
                createDebugAdapterTracker(session) {
                    const entry = current;
                    if (!entry) return undefined;
                    return {
                        onWillReceiveMessage(message) {
                            if (
                                message.type === 'request' &&
                                ['setBreakpoints', 'configurationDone'].includes(message.command)
                            ) {
                                entry.requests.push({
                                    sessionId: session.id,
                                    command: message.command,
                                    arguments: message.arguments,
                                });
                            }
                        },
                        onDidSendMessage(message) {
                            if (message.type !== 'event') return;
                            if (message.event === 'output')
                                entry.outputs.push({
                                    category: message.body.category,
                                    text: message.body.output,
                                });
                            if (message.event === 'stopped')
                                entry.stops.push({ sessionId: session.id, ...message.body });
                            if (message.event === 'breakpoint')
                                entry.breakpointEvents.push({ sessionId: session.id, ...message.body });
                        },
                    };
                },
            }),
        );

        await runCase('console: no breakpoint, direct stdout/stderr, local tsx, spaced path', async entry => {
            const actualRuntime = path.join(root, 'actual-runtime.json');
            const file = script(
                'plain file.ts',
                [
                    'import { writeFileSync } from "node:fs";',
                    'const value: number = 6;',
                    'console.log("E2E_CONSOLE_STDOUT", value);',
                    'process.stdout.write("E2E_DIRECT_STDOUT\\n");',
                    'process.stderr.write("E2E_DIRECT_STDERR\\n");',
                    `writeFileSync(${JSON.stringify(actualRuntime)}, JSON.stringify({node: process.execPath, version: process.version}));`,
                ].join('\n'),
            );
            await launch(file);
            await ended();
            assert.deepEqual(entry.stops, [], 'no startup or unknown-source pause');
            const output = entry.outputs.map(item => item.text).join('');
            for (const marker of ['E2E_CONSOLE_STDOUT', 'E2E_DIRECT_STDOUT', 'E2E_DIRECT_STDERR'])
                assert.ok(output.includes(marker), marker);
            assert.ok(!output.includes('VSCODE_INSPECTOR_OPTIONS='), 'console must not echo debugger environment');
            assert.ok(!output.includes('NODE_OPTIONS='), 'console must not echo debugger environment');
            entry.actualRuntime = JSON.parse(fs.readFileSync(actualRuntime, 'utf8'));
            assert.equal(canonical(entry.actualRuntime.node), canonical(process.env.TS_BOOTSTRAP_E2E_NODE));
        });

        await runCase('console: plain JavaScript uses Node without a loader', async entry => {
            const file = script('plain JavaScript.js', 'process.stdout.write("E2E_JAVASCRIPT_STDOUT\\n");\n');
            await launch(file);
            await ended();
            assert.deepEqual(entry.stops, []);
            assert.ok(entry.outputs.some(item => item.text.includes('E2E_JAVASCRIPT_STDOUT')));
        });

        await runCase('console: TS breakpoint binds to exact source line', async entry => {
            const file = script(
                'breakpoint file.ts',
                [
                    'const start: number = 21;',
                    'const before: string = "before";',
                    'console.log(before);',
                    'const doubled: number = start * 2;',
                    'console.log("E2E_AFTER_BREAKPOINT", doubled);',
                ].join('\n'),
            );
            vscode.debug.addBreakpoints([
                new vscode.SourceBreakpoint(new vscode.Location(vscode.Uri.file(file), new vscode.Position(3, 0))),
            ]);
            await launch(file);
            const stop = await waitFor(
                () => entry.stops[0] || (entry.terminated.length && 'terminated'),
                'first breakpoint pause',
            );
            assert.notEqual(stop, 'terminated', 'program must stop at the breakpoint');
            assert.equal(stop.reason, 'breakpoint', 'inspect unexpected pause; never auto-continue it');
            const stoppedSession = entry.sessions.find(session => session.id === stop.sessionId);
            const stack = await stoppedSession.customRequest('stackTrace', {
                threadId: stop.threadId,
                startFrame: 0,
                levels: 5,
            });
            entry.stack = stack.stackFrames;
            const top = stack.stackFrames[0];
            assert.equal(canonical(top.source.path), canonical(file), 'top frame is the original TS source');
            assert.equal(top.line, 4, 'breakpoint hits the requested original line');
            const evaluation = await stoppedSession.customRequest('evaluate', {
                expression: 'start',
                frameId: top.id,
                context: 'watch',
            });
            assert.equal(evaluation.result, '21');
            await stoppedSession.customRequest('continue', { threadId: stop.threadId });
            await ended();
            assert.equal(entry.stops.length, 1, 'no unexpected second pause');
            assert.ok(entry.outputs.some(item => item.text.includes('E2E_AFTER_BREAKPOINT')));
        });

        await runCase('terminal: interactive stdin and TTY remain available', async entry => {
            const ready = path.join(root, 'terminal-ready');
            const result = path.join(root, 'terminal-result.json');
            const file = script(
                'interactive file.ts',
                [
                    'import { writeFileSync } from "node:fs";',
                    'import { createInterface } from "node:readline";',
                    'const rl = createInterface({ input: process.stdin, output: process.stdout });',
                    `writeFileSync(${JSON.stringify(ready)}, "ready");`,
                    `rl.question("E2E_PROMPT > ", answer => { writeFileSync(${JSON.stringify(result)}, JSON.stringify({answer, tty: process.stdin.isTTY})); rl.close(); });`,
                ].join('\n'),
            );
            const existing = new Set(vscode.window.terminals);
            await launch(file, 'integratedTerminal');
            await waitFor(() => fs.existsSync(ready) || entry.stops[0], 'interactive terminal ready');
            assert.deepEqual(entry.stops, [], 'no unexpected terminal pause');
            const terminal = await waitFor(
                () => vscode.window.terminals.find(item => !existing.has(item)),
                'new debug terminal',
            );
            terminal.sendText('hello terminal');
            await ended();
            entry.stdin = JSON.parse(fs.readFileSync(result, 'utf8'));
            assert.deepEqual(entry.stdin, { answer: 'hello terminal', tty: true });
        });

        const lifecycle = script(
            'process tree.ts',
            [
                'import { spawn } from "node:child_process";',
                'import { writeFileSync } from "node:fs";',
                'const child = spawn(process.execPath, ["-e", "setInterval(() => {}, 1000)"], { stdio: "inherit" });',
                `writeFileSync(${JSON.stringify(path.join(root, 'pids.json'))}, JSON.stringify({parent: process.pid, child: child.pid}));`,
                'console.log("E2E_PROCESS_TREE_READY");',
                'setInterval(() => {}, 1000);',
            ].join('\n'),
        );
        let previous;
        for (const iteration of [1, 2]) {
            await runCase(
                `console: stop cleans process tree (${iteration === 1 ? 'initial run' : 'rerun'})`,
                async entry => {
                    const pidFile = path.join(root, 'pids.json');
                    if (fs.existsSync(pidFile)) fs.unlinkSync(pidFile);
                    const session = await launch(lifecycle);
                    await waitFor(() => fs.existsSync(pidFile) || entry.stops[0], 'process tree readiness');
                    assert.deepEqual(entry.stops, [], 'no unknown-source pause during launch');
                    const pids = JSON.parse(fs.readFileSync(pidFile, 'utf8'));
                    entry.pids = pids;
                    assert.ok(alive(pids.parent) && alive(pids.child));
                    if (previous) {
                        assert.notEqual(pids.parent, previous.parent);
                        assert.ok(!alive(previous.parent) && !alive(previous.child));
                    }
                    await vscode.debug.stopDebugging(session);
                    await ended();
                    await waitFor(
                        () => !alive(pids.parent) && !alive(pids.child),
                        'parent and child process cleanup',
                        10000,
                    );
                    previous = pids;
                },
            );
        }
        report.passed = true;
    } catch (error) {
        report.error = error.stack || String(error);
        throw error;
    } finally {
        subscriptions.forEach(item => item.dispose());
        fs.writeFileSync(path.join(root, 'result.json'), JSON.stringify(report, null, 2));
    }
};
