import * as assert from 'assert';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { getNodeExecutable, parseNvmWindowsVersions, resolveNodeFromPath } from '../../scripts/node-version';

suite('Node resolution', () => {
    test('parses real nvm-windows active and installed version lines', () => {
        assert.deepStrictEqual(
            parseNvmWindowsVersions('  * 22.12.0 (Currently using 64-bit executable)\r\n    20.18.0\r\n'),
            ['22.12.0', '20.18.0'],
        );
    });

    test('accepts legacy v prefixes, sorts, deduplicates and ignores unrelated output', () => {
        assert.deepStrictEqual(
            parseNvmWindowsVersions(
                '  v18.20.4\n* v22.12.0 (Currently using 64-bit executable)\n22.12.0\nnvm 1.1.12\nNo installations recognized.\n',
            ),
            ['22.12.0', '18.20.4'],
        );
        assert.deepStrictEqual(parseNvmWindowsVersions('No installations recognized.'), []);
    });

    test('rejects invalid selected Node versions', async () => {
        assert.strictEqual(await getNodeExecutable('22; echo unsafe'), undefined);
    });

    test('resolves an absolute executable with spaces in its PATH and respects order', async () => {
        const root = fs.mkdtempSync(path.join(os.tmpdir(), 'node resolution '));
        try {
            const first = path.join(root, 'first');
            const second = path.join(root, 'second');
            fs.mkdirSync(first);
            fs.mkdirSync(second);
            const executableName = process.platform === 'win32' ? 'node.exe' : 'node';
            for (const directory of [first, second]) {
                const executable = path.join(directory, executableName);
                fs.writeFileSync(executable, 'test fixture');
                fs.chmodSync(executable, 0o755);
            }
            assert.strictEqual(
                resolveNodeFromPath({ PATH: [first, second].join(path.delimiter) }),
                path.join(first, executableName),
            );
            if (process.platform === 'win32') {
                assert.strictEqual(resolveNodeFromPath({ Path: `"${first}"` }), path.join(first, executableName));
            }
            const pathKey = Object.keys(process.env).find(key => key.toLowerCase() === 'path') ?? 'PATH';
            const originalPath = process.env[pathKey];
            try {
                process.env[pathKey] = first;
                assert.strictEqual(await getNodeExecutable(), path.join(first, executableName));
            } finally {
                if (originalPath === undefined) {
                    delete process.env[pathKey];
                } else {
                    process.env[pathKey] = originalPath;
                }
            }
            assert.strictEqual(resolveNodeFromPath({ PATH: 'relative/path' }), undefined);
            assert.strictEqual(resolveNodeFromPath({ PATH: '' }), undefined);
            assert.strictEqual(resolveNodeFromPath({}), undefined);
        } finally {
            fs.rmSync(root, { recursive: true, force: true });
        }
    });

    test('ignores a non-executable POSIX Node candidate', () => {
        if (process.platform === 'win32') {
            return;
        }
        const root = fs.mkdtempSync(path.join(os.tmpdir(), 'node-no-exec-'));
        try {
            fs.writeFileSync(path.join(root, 'node'), 'fixture', { mode: 0o644 });
            assert.strictEqual(resolveNodeFromPath({ PATH: root }), undefined);
        } finally {
            fs.rmSync(root, { recursive: true, force: true });
        }
    });
});
