import * as assert from 'assert';

// You can import and use all API from the 'vscode' module
// as well as import your extension to test it
import * as vscode from 'vscode';
import { getFileRuntime } from '../../scripts/run-files';
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
});
