# Change Log

All notable changes to the "ts-bootstrap" extension will be documented in this file.

Check [Keep a Changelog](http://keepachangelog.com/) for recommendations on how to structure this file.

## [0.2.11] - 2026-10-22

- Open the Debug Console by default and capture stdout/stderr without the long terminal environment command. VS Code may still show a single startup command line; logged objects are captured as text.
- Add the resource-scoped `ts-bootstrap.debugConsole` setting. Select `integratedTerminal` for interactive input, readline, prompts, or TTY-dependent programs.
- Include the target file name in debug session names. Use standard VS Code JavaScript debugging, with no forced entry pause or interception of breakpoint and exception stops.
- Resolve the same absolute Node.js executable, tsx loader, working directory, and inherited environment for Run and Debug. Pass only necessary PATH overrides instead of copying the extension host's environment into the launch command.
- Prefer the nearest project-local tsx installation, then the selected Node.js environment and PATH. Resolve runtimes afresh after switching Node or changing installations.
- Keep different files' runs independent and stop only the same file's previous task on rerun. Standalone files retain their output in a dedicated terminal.
- Fix nvm-windows version parsing with or without the `v` prefix, and clarify the resource-scoped workspace-versus-file working-directory setting.

## [0.2.8]

- Updated the development and publishing toolchain to markdown-it 14.3.3 to address GHSA-gfr2-rv44-r23c and GHSA-r7fv-28h4-cvq7
- No changes to the extension runtime functionality

## [0.2.7]

- Replaced ts-node with tsx for reliable TypeScript execution on modern Node.js and TypeScript versions
- Added runtime verification and per-version installation when running through nvm
- Added a clear Node.js 18 minimum-version check for TypeScript execution
- Fixed tsx debugging hanging under nvm by launching the target Node.js process directly instead of auto-attaching to tsx workers
- Simplified selected-version debugging by launching the resolved nvm Node executable without rewriting the full PATH
- Accelerated selected-version startup by resolving and caching Node.js and tsx runtimes without repeated login-shell commands

## [0.2.6]

- Fixed the false installation failure prompt after ts-node was installed successfully
- Improved dependency checks, command flow, error handling, and test coverage for a smoother run and debug experience

## [0.2.4]

- Group debug and run commands, placing run before debug

## [0.2.3]

- Enhanced internationalization support with updated ts-node installation prompts and error messages
- Updated multi-language support with restart prompts and related information
- Added comprehensive l10n support with updated internationalization features

## [0.2.0]

- Added cross-platform compatibility for nvm commands
- Updated ESLint and Prettier configuration with formatting support
- Enhanced cross-platform support documentation and functionality optimization
- Added multi-language support with improved ts-node installation prompts and Node.js version selection
- Improved changelog configuration and version management

## [0.1.1]

- Added changelog information to package.json for better marketplace integration
- Improved release process with dedicated scripts

## [0.1.0]

- Updated extension icon and optimized command icons
- Added multi-language support
- Improved UI elements and user experience

## [0.0.3]

- Added ability to select Node.js version for running and debugging
- Added Node.js version display feature
- Added semver dependency for better Node.js version handling
- Updated README with feature descriptions and usage instructions

[0.2.11]: https://github.com/spe-shun/ts-bootstrap/releases/tag/0.2.11
[0.2.8]: https://github.com/spe-shun/ts-bootstrap/releases/tag/0.2.8
[0.2.7]: https://github.com/spe-shun/ts-bootstrap/releases/tag/0.2.7
[0.2.6]: https://github.com/spe-shun/ts-bootstrap/releases/tag/0.2.6
[0.2.4]: https://github.com/spe-shun/ts-bootstrap/releases/tag/0.2.4
[0.2.3]: https://github.com/spe-shun/ts-bootstrap/releases/tag/0.2.3
[0.2.0]: https://github.com/spe-shun/ts-bootstrap/releases/tag/0.2.0
[0.1.1]: https://github.com/spe-shun/ts-bootstrap/releases/tag/0.1.1
[0.1.0]: https://github.com/spe-shun/ts-bootstrap/releases/tag/0.1.0
[0.0.3]: https://github.com/spe-shun/ts-bootstrap/releases/tag/0.0.3
