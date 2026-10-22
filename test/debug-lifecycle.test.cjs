const assert = require('node:assert/strict');
const { test, afterEach } = require('node:test');
const Module = require('node:module');
const { EventEmitter } = require('node:events');
let socketMode = 'success';
const sockets = [];
class FakeSocket extends EventEmitter {
    constructor() {
        super();
        sockets.push(this);
        setImmediate(() => this.emit('open'));
    }
    send(_request, callback) {
        callback();
        if (socketMode === 'close') this.emit('close');
        if (socketMode === 'success') this.emit('message', Buffer.from('{"id":1}'));
    }
    terminate() {
        this.terminated = true;
    }
}

const stopped = [];
const errors = [];
let command = () => new Promise(() => {});
const mock = {
    window: {
        createOutputChannel: () => ({ appendLine() {}, show() {}, dispose() {} }),
        showErrorMessage: async message => {
            errors.push(message);
        },
    },
    commands: { executeCommand: (...args) => command(...args) },
    debug: {
        stopDebugging: async session => {
            stopped.push(session.id);
        },
    },
};
const originalLoad = Module._load;
Module._load = function (request, parent, ...rest) {
    if (request === 'vscode') return mock;
    if (request === 'ws') return FakeSocket;
    if (request === './run-files' && parent.filename.endsWith('debug-file.js')) {
        return { getExecutionDirectory: () => '/work' };
    }
    return originalLoad.call(this, request, parent, ...rest);
};
const lifecycle = require('../out/scripts/debug-file.js');
Module._load = originalLoad;
const wait = ms => new Promise(resolve => setTimeout(resolve, ms));
function target(id = 'target') {
    const requests = [];
    return {
        id,
        requests,
        parentSession: {
            id: 'parent',
            name: lifecycle.DEBUG_SESSION_NAME,
            configuration: { [lifecycle.DEBUG_SESSION_MARKER]: true, __tsBootstrapTsx: true },
        },
        customRequest: async (name, args) => {
            requests.push({ name, args });
        },
    };
}
const stop = (reason = 'entry', threadId = 7) => ({ type: 'event', event: 'stopped', body: { reason, threadId } });
afterEach(() => {
    lifecycle.disposeDebugSessions();
    stopped.length = 0;
    errors.length = 0;
    sockets.length = 0;
    socketMode = 'success';
    command = () => new Promise(() => {});
});
test('only entry pauses are continued, once, after preparation', async () => {
    const session = target();
    let count = 0;
    const tracker = lifecycle.createDebugAdapterTracker(session, async () => {
        count++;
    });
    tracker.onDidSendMessage(stop('breakpoint'));
    await wait(0);
    assert.equal(count, 0);
    tracker.onDidSendMessage(stop());
    await wait(0);
    tracker.onDidSendMessage(stop('exception'));
    assert.equal(count, 1);
    assert.deepEqual(session.requests, [{ name: 'continue', args: { threadId: 7 } }]);
});
test('termination cancels late preparation without stopping another session', async () => {
    const session = target();
    let resolve;
    const tracker = lifecycle.createDebugAdapterTracker(
        session,
        () =>
            new Promise(r => {
                resolve = r;
            }),
    );
    tracker.onDidSendMessage(stop());
    await wait(0);
    lifecycle.releaseDebugSession(session.parentSession);
    resolve();
    await wait(0);
    assert.deepEqual(session.requests, []);
    assert.deepEqual(stopped, []);
    assert.deepEqual(errors, []);
});
test('breakpoint reached during preparation is not automatically continued', async () => {
    const session = target();
    let resolve;
    const tracker = lifecycle.createDebugAdapterTracker(
        session,
        () =>
            new Promise(r => {
                resolve = r;
            }),
    );
    tracker.onDidSendMessage(stop());
    await wait(0);
    tracker.onDidSendMessage(stop('breakpoint', 8));
    resolve();
    await wait(0);
    assert.deepEqual(session.requests, []);
});
test('rejected initialization is surfaced and stops only the owned target', async () => {
    const session = target();
    const tracker = lifecycle.createDebugAdapterTracker(session, async () => {
        throw new Error('proxy unavailable');
    });
    tracker.onDidSendMessage(stop());
    await wait(0);
    assert.deepEqual(stopped, ['target']);
    assert.equal(errors.length, 1);
    assert.deepEqual(session.requests, []);
});
test('hanging initialization times out and permits a fresh retry', async () => {
    const session = target();
    const tracker = lifecycle.createDebugAdapterTracker(session, () => new Promise(() => {}), 10);
    tracker.onDidSendMessage(stop());
    await wait(30);
    assert.deepEqual(stopped, ['target']);
    lifecycle.releaseDebugSession(session);
    const retry = target();
    lifecycle.createDebugAdapterTracker(retry, async () => {}).onDidSendMessage(stop());
    await wait(0);
    assert.equal(retry.requests.length, 1);
});
test('failed initialization preserves a breakpoint reached meanwhile', async () => {
    const session = target();
    let reject;
    const tracker = lifecycle.createDebugAdapterTracker(
        session,
        () =>
            new Promise((_, r) => {
                reject = r;
            }),
    );
    tracker.onDidSendMessage(stop());
    await wait(0);
    tracker.onDidSendMessage(stop('breakpoint'));
    reject(new Error('failure'));
    await wait(0);
    assert.deepEqual(stopped, []);
    assert.equal(errors.length, 1);
});
test('unrelated and plain JS sessions are untouched', () => {
    assert.equal(lifecycle.createDebugAdapterTracker({ id: 'other' }), undefined);
    const js = target();
    delete js.parentSession.configuration.__tsBootstrapTsx;
    assert.equal(lifecycle.createDebugAdapterTracker(js), undefined);
});
test('pending real CDP proxy request is cancellable', async () => {
    const session = target();
    lifecycle.prepareDebugSession(session);
    lifecycle.releaseDebugSession(session);
    await wait(0);
    assert.deepEqual(stopped, []);
    assert.deepEqual(errors, []);
});

test('closed CDP socket reports initialization failure and releases connection', async () => {
    command = async () => ({ port: 1234, path: '/test' });
    socketMode = 'close';
    lifecycle.prepareDebugSession(target());
    await wait(10);
    assert.deepEqual(stopped, ['target']);
    assert.equal(errors.length, 1);
    assert.equal(sockets[0].terminated, true);
});
test('cancelling an open CDP socket closes it without reporting an error', async () => {
    command = async () => ({ port: 1234, path: '/test' });
    socketMode = 'pending';
    const session = target();
    lifecycle.prepareDebugSession(session);
    await wait(10);
    lifecycle.releaseDebugSession(session);
    await wait(0);
    assert.equal(sockets[0].terminated, true);
    assert.deepEqual(errors, []);
});
test('an unresponsive CDP proxy command has a bounded deadline', async () => {
    lifecycle.prepareDebugSession(target());
    await wait(3100);
    assert.deepEqual(stopped, ['target']);
    assert.equal(errors.length, 1);
});
