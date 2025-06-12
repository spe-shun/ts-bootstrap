import * as assert from 'assert';
import { parseWindowsNvmOutput, parseUnixNvmOutput } from '../../scripts/node-version';

describe('Node Version Parsing', () => {
    it('should parse versions from nvm-windows output', () => {
        const output = `\n  * v20.5.1 (Currently using 64-bit executable)\n    v18.16.0\n    v16.14.0\n`;
        const versions = parseWindowsNvmOutput(output);
        assert.deepStrictEqual(versions, ['20.5.1', '18.16.0', '16.14.0']);
    });

    it('should parse versions from standard nvm output', () => {
        const output = `\n       v18.12.1\n->     v20.2.0\n        system\ndefault -> v18.12.1\n`;
        const versions = parseUnixNvmOutput(output);
        assert.deepStrictEqual(versions, ['20.2.0', '18.12.1']);
    });
});
