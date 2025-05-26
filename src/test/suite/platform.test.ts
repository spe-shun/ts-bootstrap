import * as assert from 'assert';
import * as os from 'os';
import { 
    isWindows, 
    isMacOS, 
    isLinux, 
    isWSL, 
    isPowerShell, 
    isCmd, 
    getShellType, 
    getCommandSeparator, 
    normalizePath 
} from '../../utils';

suite('Platform Detection Test Suite', () => {
    test('Should detect platform correctly', () => {
        const platform = os.platform();
        
        if (platform === 'win32') {
            assert.strictEqual(isWindows, true);
            assert.strictEqual(isMacOS, false);
            assert.strictEqual(isLinux, false);
        } else if (platform === 'darwin') {
            assert.strictEqual(isWindows, false);
            assert.strictEqual(isMacOS, true);
            assert.strictEqual(isLinux, false);
        } else if (platform === 'linux') {
            assert.strictEqual(isWindows, false);
            assert.strictEqual(isMacOS, false);
            assert.strictEqual(isLinux, true);
        }
    });

    test('Should detect WSL correctly', () => {
        if (os.platform() === 'linux') {
            const release = os.release().toLowerCase();
            const expectedWSL = release.includes('microsoft');
            assert.strictEqual(isWSL, expectedWSL);
        } else {
            assert.strictEqual(isWSL, false);
        }
    });

    test('Should normalize paths correctly', () => {
        const unixPath = '/home/user/project/file.ts';
        const windowsPath = 'C:\\Users\\user\\project\\file.ts';
        
        if (isWindows && !isWSL) {
            // Windows should convert forward slashes to backslashes
            assert.strictEqual(normalizePath(unixPath), '\\home\\user\\project\\file.ts');
            assert.strictEqual(normalizePath(windowsPath), windowsPath);
        } else {
            // Unix-like systems should convert backslashes to forward slashes
            assert.strictEqual(normalizePath(unixPath), unixPath);
            assert.strictEqual(normalizePath(windowsPath), 'C:/Users/user/project/file.ts');
        }
    });

    test('Should return appropriate command separator', () => {
        const separator = getCommandSeparator();
        const shellType = getShellType();
        
        switch (shellType) {
            case 'powershell':
                assert.strictEqual(separator, ';');
                break;
            case 'cmd':
                assert.strictEqual(separator, '&');
                break;
            default:
                assert.strictEqual(separator, '&&');
                break;
        }
    });

    test('Shell detection should not throw errors', () => {
        assert.doesNotThrow(() => {
            isPowerShell();
            isCmd();
            getShellType();
        });
    });

    test('Platform utilities should be consistent', () => {
        // Only one platform should be true
        const platforms = [isWindows, isMacOS, isLinux];
        const truePlatforms = platforms.filter(p => p);
        assert.strictEqual(truePlatforms.length, 1, 'Exactly one platform should be detected as true');
        
        // WSL should only be true on Linux
        if (isWSL) {
            assert.strictEqual(isLinux, true, 'WSL should only be detected on Linux');
        }
        
        // Windows-specific shells should only be detected on Windows
        if (isPowerShell() || isCmd()) {
            // Note: PowerShell can run on other platforms, so this test is relaxed
            // Only CMD should be strictly Windows-only
            if (isCmd()) {
                assert.strictEqual(isWindows, true, 'CMD should only be detected on Windows');
            }
        }
    });
}); 