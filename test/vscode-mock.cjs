const path = require('node:path');
const { pathToFileURL } = require('node:url');
const listeners = new Set();
const terminalListeners = new Set();
const state = { tasks: [], configuration: true, folder: undefined, configResource: undefined };
const emitEnd = execution => {
    for (const listener of [...listeners]) listener({ execution });
};
const uri = file => ({ fsPath: path.resolve(file), toString: () => pathToFileURL(path.resolve(file)).toString() });
const vscode = {
    Uri: { file: uri },
    l10n: { t: key => key },
    window: {
        onDidCloseTerminal: listener => {
            terminalListeners.add(listener);
            return { dispose: () => terminalListeners.delete(listener) };
        },
        createTerminal: options => ({
            options,
            show() {},
            dispose() {
                this.disposed = true;
                for (const fn of [...terminalListeners]) fn(this);
            },
        }),
        showInformationMessage: async () => {},
        showErrorMessage: async () => {},
        showWarningMessage: async () => {},
        createOutputChannel: () => ({ appendLine() {}, dispose() {}, show() {} }),
    },
    workspace: {
        getWorkspaceFolder: () => state.folder,
        getConfiguration: (_section, resource) => {
            state.configResource = resource;
            return { get: () => state.configuration };
        },
    },
    Task: class {
        constructor(definition, scope, name, source, execution, problemMatchers) {
            Object.assign(this, { definition, scope, name, source, execution, problemMatchers });
        }
    },
    ProcessExecution: class {
        constructor(process, args, options) {
            Object.assign(this, { process, args, options });
        }
    },
    TaskScope: { Global: 1, Workspace: 2 },
    TaskRevealKind: { Always: 1 },
    TaskPanelKind: { Dedicated: 2 },
    tasks: {
        onDidEndTask: listener => {
            listeners.add(listener);
            return { dispose: () => listeners.delete(listener) };
        },
        executeTask: async task => {
            const execution = {
                task,
                terminated: false,
                terminate() {
                    this.terminated = true;
                    emitEnd(this);
                },
            };
            state.tasks.push(execution);
            return execution;
        },
    },
};
module.exports = { vscode, state, emitEnd };
