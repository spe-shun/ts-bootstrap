import * as childProcess from 'child_process';
import * as fs from 'fs';
import * as path from 'path';
import * as semver from 'semver';
import * as vscode from 'vscode';
import { getCommandSeparator, isWindows } from '../utils';
import { t } from '../utils/l10n';
import { getNodeExecutable, getNvmUseCommand } from './node-version';

const INSTALL_COMMAND = 'npm install --global tsx@4';
const INSTALL_TASK_TYPE = 'ts-bootstrap';
const MINIMUM_NODE_VERSION = '18.0.0';
const DEFAULT_INSTALLATION_KEY = 'current';
const TSX_LOADER_RELATIVE_PATH = path.join('dist', 'loader.mjs');
const IMPORT_LOADER_RANGE = '>=20.6.0 || >=18.19.0 <19.0.0';

type InstallationResult = 'succeeded' | 'failed' | 'cancelled';

export interface TsxDebugRuntime {
    loaderPath: string;
    loaderFlag: '--import' | '--loader';
    nodeVersion: string;
}

const confirmedInstallations = new Set<string>();
const pendingInstallations = new Map<string, Promise<boolean>>();
const resolvedDebugRuntimes = new Map<string, TsxDebugRuntime>();
let installationTaskId = 0;

function getInstallationKey(nodeVersion?: string): string {
    return nodeVersion ?? DEFAULT_INSTALLATION_KEY;
}

export function isTsxNodeVersionSupported(nodeVersion?: string): boolean {
    return !nodeVersion || semver.gte(nodeVersion, MINIMUM_NODE_VERSION);
}

function getVersionAwareCommand(command: string, nodeVersion?: string): string {
    if (!nodeVersion) {
        return command;
    }

    return [getNvmUseCommand(nodeVersion), command].join(` ${getCommandSeparator()} `);
}

export function getTsxInstallationCommand(nodeVersion?: string): string {
    return getVersionAwareCommand(INSTALL_COMMAND, nodeVersion);
}

function executeFile(command: string, args: string[]): Promise<string | undefined> {
    return new Promise(resolve => {
        childProcess.execFile(command, args, { timeout: 10000, windowsHide: true }, (error, stdout) => {
            resolve(error ? undefined : stdout.trim());
        });
    });
}

function getLastVersion(output: string | undefined): string | undefined {
    const versions = output?.match(/v?\d+\.\d+\.\d+/g);
    return versions?.at(-1)?.replace(/^v/, '');
}

function isFile(candidate: string): boolean {
    try {
        return fs.statSync(candidate).isFile();
    } catch {
        return false;
    }
}

function getExecutableCandidates(command: string): string[] {
    const pathDirectories = (process.env.PATH ?? '').split(path.delimiter).filter(directory => directory.length > 0);
    const extensions = isWindows
        ? (process.env.PATHEXT ?? '.COM;.EXE;.BAT;.CMD').split(';').filter(extension => extension.length > 0)
        : [''];
    const executableNames = isWindows ? extensions.map(extension => `${command}${extension.toLowerCase()}`) : [command];

    return pathDirectories.flatMap(directory => executableNames.map(name => path.join(directory, name))).filter(isFile);
}

function getNvmVersionBinDirectory(executablePath: string): string | undefined {
    const binDirectory = path.dirname(executablePath);
    const versionDirectory = path.dirname(binDirectory);
    const nodeDirectory = path.dirname(versionDirectory);
    const versionsDirectory = path.dirname(nodeDirectory);

    if (
        path.basename(binDirectory) !== 'bin' ||
        path.basename(nodeDirectory) !== 'node' ||
        path.basename(versionsDirectory) !== 'versions' ||
        !semver.valid(path.basename(versionDirectory).replace(/^v/, ''))
    ) {
        return undefined;
    }

    return binDirectory;
}

function isVisibleWithSelectedNode(executablePath: string, nodeExecutable?: string): boolean {
    if (!nodeExecutable) {
        return true;
    }

    const executableNvmBin = getNvmVersionBinDirectory(executablePath);
    const selectedNvmBin = getNvmVersionBinDirectory(nodeExecutable);
    return !executableNvmBin || !selectedNvmBin || path.resolve(executableNvmBin) === path.resolve(selectedNvmBin);
}

function findTsxPackageRootFromExecutable(executablePath: string): string | undefined {
    const executableDirectory = path.dirname(executablePath);
    const shimCandidates = [
        path.join(executableDirectory, 'node_modules', 'tsx'),
        path.join(path.dirname(executableDirectory), 'node_modules', 'tsx'),
    ];

    for (const candidate of shimCandidates) {
        if (fs.existsSync(path.join(candidate, TSX_LOADER_RELATIVE_PATH))) {
            return candidate;
        }
    }

    let currentPath: string;
    try {
        currentPath = fs.realpathSync(executablePath);
    } catch {
        return undefined;
    }

    if (!fs.statSync(currentPath).isDirectory()) {
        currentPath = path.dirname(currentPath);
    }

    for (let depth = 0; depth < 8; depth += 1) {
        const packageJsonPath = path.join(currentPath, 'package.json');
        try {
            const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8')) as { name?: string };
            if (packageJson.name === 'tsx') {
                return currentPath;
            }
        } catch {
            // Continue walking toward the filesystem root.
        }

        const parentPath = path.dirname(currentPath);
        if (parentPath === currentPath) {
            break;
        }
        currentPath = parentPath;
    }

    return undefined;
}

function findLoaderInPackageRoot(packageRoot: string): string | undefined {
    const loaderPath = path.join(packageRoot, TSX_LOADER_RELATIVE_PATH);
    return isFile(loaderPath) ? loaderPath : undefined;
}

function resolveTsxLoaderPath(nodeExecutable?: string): string | undefined {
    if (nodeExecutable) {
        const nodeBinDirectory = path.dirname(nodeExecutable);
        const packageRoots = [
            path.join(nodeBinDirectory, 'node_modules', 'tsx'),
            path.resolve(nodeBinDirectory, '..', 'lib', 'node_modules', 'tsx'),
        ];

        for (const packageRoot of packageRoots) {
            const loaderPath = findLoaderInPackageRoot(packageRoot);
            if (loaderPath) {
                return loaderPath;
            }
        }
    }

    for (const executablePath of getExecutableCandidates('tsx')) {
        if (!isVisibleWithSelectedNode(executablePath, nodeExecutable)) {
            continue;
        }

        const packageRoot = findTsxPackageRootFromExecutable(executablePath);
        if (packageRoot) {
            return findLoaderInPackageRoot(packageRoot);
        }
    }

    return undefined;
}

export function getTsxLoaderFlag(nodeVersion: string): '--import' | '--loader' {
    return semver.satisfies(nodeVersion, IMPORT_LOADER_RANGE) ? '--import' : '--loader';
}

export async function getTsxDebugRuntime(
    nodeVersion?: string,
    nodeExecutable?: string,
): Promise<TsxDebugRuntime | undefined> {
    const resolvedNodeExecutable =
        nodeExecutable ?? (nodeVersion ? await getNodeExecutable(nodeVersion) : getExecutableCandidates('node')[0]);
    if (!resolvedNodeExecutable) {
        return undefined;
    }

    const runtimeKey = `${nodeVersion ?? 'current'}\0${resolvedNodeExecutable}`;
    const cachedRuntime = resolvedDebugRuntimes.get(runtimeKey);
    if (cachedRuntime && isFile(cachedRuntime.loaderPath)) {
        return cachedRuntime;
    }

    const resolvedNodeVersion = nodeVersion ?? getLastVersion(await executeFile(resolvedNodeExecutable, ['--version']));
    if (!resolvedNodeVersion || !isTsxNodeVersionSupported(resolvedNodeVersion)) {
        return undefined;
    }

    const loaderPath = resolveTsxLoaderPath(resolvedNodeExecutable);
    if (!loaderPath) {
        return undefined;
    }

    const runtime = {
        loaderPath,
        loaderFlag: getTsxLoaderFlag(resolvedNodeVersion),
        nodeVersion: resolvedNodeVersion,
    };
    resolvedDebugRuntimes.set(runtimeKey, runtime);
    return runtime;
}

/** Check the exact Node.js environment selected for execution. */
export async function isTsxInstalled(nodeVersion?: string, nodeExecutable?: string): Promise<boolean> {
    const installationKey = getInstallationKey(nodeVersion);
    if (confirmedInstallations.has(installationKey)) {
        return true;
    }

    const isAvailable = !!(await getTsxDebugRuntime(nodeVersion, nodeExecutable));

    if (isAvailable) {
        confirmedInstallations.add(installationKey);
    }

    return isAvailable;
}

function createInstallationTask(resource: vscode.Uri, taskId: number, nodeVersion?: string): vscode.Task {
    const scope = vscode.workspace.getWorkspaceFolder(resource) ?? vscode.TaskScope.Workspace;
    const command = getTsxInstallationCommand(nodeVersion);
    const task = new vscode.Task(
        { type: INSTALL_TASK_TYPE, command: 'install-tsx', taskId, nodeVersion },
        scope,
        t('tsx.installTerminalName'),
        INSTALL_TASK_TYPE,
        new vscode.ShellExecution(command),
        [],
    );

    task.presentationOptions = {
        reveal: vscode.TaskRevealKind.Always,
        panel: vscode.TaskPanelKind.Dedicated,
        clear: true,
        echo: true,
        focus: false,
        showReuseMessage: false,
    };

    return task;
}

async function runInstallationTask(
    resource: vscode.Uri,
    token: vscode.CancellationToken,
    nodeVersion?: string,
): Promise<InstallationResult> {
    const taskId = ++installationTaskId;
    const task = createInstallationTask(resource, taskId, nodeVersion);
    let execution: vscode.TaskExecution | undefined;
    let cancelled = token.isCancellationRequested;
    let settled = false;
    let resolveResult: (result: InstallationResult) => void;

    const resultPromise = new Promise<InstallationResult>(resolve => {
        resolveResult = resolve;
    });
    const isCurrentTask = (candidate: vscode.TaskExecution) =>
        candidate.task.definition.type === INSTALL_TASK_TYPE && candidate.task.definition.taskId === taskId;
    const disposeAndResolve = (result: InstallationResult) => {
        if (settled) {
            return;
        }
        settled = true;
        processEndDisposable.dispose();
        taskEndDisposable.dispose();
        cancellationDisposable.dispose();
        resolveResult(result);
    };
    const processEndDisposable = vscode.tasks.onDidEndTaskProcess(event => {
        if (!isCurrentTask(event.execution)) {
            return;
        }

        if (cancelled) {
            disposeAndResolve('cancelled');
        } else {
            disposeAndResolve(event.exitCode === 0 ? 'succeeded' : 'failed');
        }
    });
    const taskEndDisposable = vscode.tasks.onDidEndTask(event => {
        if (!isCurrentTask(event.execution)) {
            return;
        }

        // Shell tasks normally emit the process event first. Keep a fallback
        // for a task that ends before its shell process is ever started.
        setTimeout(() => disposeAndResolve(cancelled ? 'cancelled' : 'failed'), 0);
    });
    const cancellationDisposable = token.onCancellationRequested(() => {
        cancelled = true;
        execution?.terminate();
    });

    try {
        execution = await vscode.tasks.executeTask(task);
        if (cancelled) {
            execution.terminate();
        }
    } catch {
        disposeAndResolve('failed');
    }

    return resultPromise;
}

async function installTsx(resource: vscode.Uri, nodeVersion?: string, nodeExecutable?: string): Promise<boolean> {
    const retryButton = t('tsx.retryButton');

    const result = await vscode.window.withProgress(
        {
            location: vscode.ProgressLocation.Notification,
            title: t('tsx.installing'),
            cancellable: true,
        },
        (_progress, token) => runInstallationTask(resource, token, nodeVersion),
    );

    if (result === 'succeeded' && (await isTsxInstalled(nodeVersion, nodeExecutable))) {
        vscode.window.showInformationMessage(t('tsx.installCompleted'));
        return true;
    }

    if (result === 'cancelled') {
        return false;
    }

    const selection = await vscode.window.showErrorMessage(t('tsx.installFailed'), retryButton);
    return selection === retryButton ? installTsx(resource, nodeVersion, nodeExecutable) : false;
}

async function promptForInstallation(
    resource: vscode.Uri,
    nodeVersion?: string,
    nodeExecutable?: string,
): Promise<boolean> {
    if (await isTsxInstalled(nodeVersion, nodeExecutable)) {
        return true;
    }

    const installButton = t('tsx.installButton');
    const selection = await vscode.window.showWarningMessage(t('tsx.notInstalled'), installButton);

    if (selection !== installButton) {
        return false;
    }

    return installTsx(resource, nodeVersion, nodeExecutable);
}

/**
 * Ensure tsx is available in the Node.js environment that will execute the
 * TypeScript file. Concurrent requests for the same Node.js version share the
 * same prompt and installation task.
 */
export async function ensureTsxInstallation(
    resource: vscode.Uri,
    nodeVersion?: string,
    nodeExecutable?: string,
): Promise<boolean> {
    if (!isTsxNodeVersionSupported(nodeVersion)) {
        vscode.window.showErrorMessage(t('tsx.unsupportedNodeVersion'));
        return false;
    }

    const installationKey = getInstallationKey(nodeVersion);
    const pendingInstallation = pendingInstallations.get(installationKey);
    if (pendingInstallation) {
        return pendingInstallation;
    }

    const request = promptForInstallation(resource, nodeVersion, nodeExecutable);
    pendingInstallations.set(installationKey, request);

    try {
        return await request;
    } finally {
        if (pendingInstallations.get(installationKey) === request) {
            pendingInstallations.delete(installationKey);
        }
    }
}
