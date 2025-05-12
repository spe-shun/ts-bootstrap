import * as childProcess from 'child_process';
import * as vscode from 'vscode';

// 节流控制变量
let lastUpdateTime = 0;
const THROTTLE_TIME = 10000; // 10秒节流时间

/**
 * 创建显示 Node.js 版本的状态栏项
 */
export function setupNodeVersionStatusBar(context: vscode.ExtensionContext): vscode.StatusBarItem {
    // 创建状态栏项 - 提高优先级到1000
    const nodeVersionStatusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left, 1000);
    nodeVersionStatusBarItem.command = 'extension.ts-bootstrap.showNodeVersion';
    context.subscriptions.push(nodeVersionStatusBarItem);
    
    // 初始检查当前文件
    checkCurrentEditor(nodeVersionStatusBarItem);
    
    // 监听编辑器焦点变化事件
    context.subscriptions.push(
        vscode.window.onDidChangeActiveTextEditor((editor) => {
            checkCurrentEditor(nodeVersionStatusBarItem);
        })
    );
    
    // 注册显示版本详情的命令
    const showNodeVersionCmd = vscode.commands.registerCommand('extension.ts-bootstrap.showNodeVersion', () => {
        showNodeVersionInfo();
    });
    context.subscriptions.push(showNodeVersionCmd);
    
    return nodeVersionStatusBarItem;
}

/**
 * 检查当前编辑器并决定是否显示状态栏
 */
function checkCurrentEditor(statusBarItem: vscode.StatusBarItem): void {
    const editor = vscode.window.activeTextEditor;
    
    if (editor && (editor.document.languageId === 'typescript' || editor.document.languageId === 'javascript')) {
        // 使用节流函数更新状态栏
        throttledUpdateNodeVersion(statusBarItem);
    } else {
        // 隐藏状态栏
        statusBarItem.hide();
    }
}

/**
 * 节流函数，10秒内仅执行一次更新
 */
function throttledUpdateNodeVersion(statusBarItem: vscode.StatusBarItem): void {
    const now = Date.now();
    if (now - lastUpdateTime > THROTTLE_TIME) {
        updateNodeVersion(statusBarItem);
        lastUpdateTime = now;
    } else {
        // 即使不更新也要确保显示
        statusBarItem.show();
    }
}

/**
 * 更新状态栏项上的 Node.js 版本信息
 */
export function updateNodeVersion(statusBarItem: vscode.StatusBarItem): void {
    try {
        const nodeVersion = childProcess.execSync('node --version').toString().trim();
        statusBarItem.text = `$(versions) Node ${nodeVersion}`;
        statusBarItem.tooltip = `当前 Node.js 版本: ${nodeVersion}`;
        statusBarItem.show();
    } catch (error) {
        statusBarItem.text = '$(warning) Node ?';
        statusBarItem.tooltip = 'Node.js 未找到或无法获取版本';
        statusBarItem.show();
    }
}

/**
 * 显示 Node.js 版本详细信息
 */
export function showNodeVersionInfo(): void {
    try {
        const nodeVersion = childProcess.execSync('node --version').toString().trim();
        vscode.window.showInformationMessage(`当前 Node.js 版本: ${nodeVersion}`);
    } catch (error) {
        vscode.window.showErrorMessage('无法获取 Node.js 版本信息');
    }
} 