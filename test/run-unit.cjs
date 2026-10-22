// This suite intentionally mocks the VS Code API. Electron integration remains yarn test.
const Module = require('node:module');
const path = require('node:path');
const Mocha = require('mocha');
const { vscode } = require('./vscode-mock.cjs');
const original = Module._load;
Module._load = function (request, ...rest) {
    return request === 'vscode' ? vscode : original.call(this, request, ...rest);
};
const mocha = new Mocha({ ui: 'tdd' });
for (const file of ['extension.test.js', 'platform.test.js', 'node-resolution.test.js'])
    mocha.addFile(path.join(__dirname, '../out/test/suite', file));
mocha.run(failures => {
    Module._load = original;
    process.exitCode = failures ? 1 : 0;
});
