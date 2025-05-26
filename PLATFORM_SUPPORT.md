# Cross-Platform Support

This document outlines the cross-platform compatibility features of the TS/JS Runner & Debugger extension.

## Supported Platforms

### ✅ Fully Supported

- **Windows 10/11**
  - Native Windows with PowerShell
  - Native Windows with Command Prompt (cmd)
  - WSL (Windows Subsystem for Linux) with bash/zsh
  
- **macOS**
  - macOS 10.15+ with bash
  - macOS 10.15+ with zsh (default)
  
- **Linux**
  - Ubuntu 18.04+
  - Debian 10+
  - CentOS 7+
  - Fedora 30+
  - Arch Linux
  - Other major distributions

### 🐚 Shell Support

| Shell | Windows | macOS | Linux | WSL |
|-------|---------|-------|-------|-----|
| PowerShell | ✅ | ✅ | ✅ | ✅ |
| Command Prompt (cmd) | ✅ | ❌ | ❌ | ❌ |
| Bash | ❌ | ✅ | ✅ | ✅ |
| Zsh | ❌ | ✅ | ✅ | ✅ |
| Fish | ❌ | ✅ | ✅ | ✅ |

## Node Version Management

### NVM Support

The extension supports multiple Node.js version managers:

#### Windows
- **nvm-windows**: Native Windows Node version manager
- **Installation**: Download from [nvm-windows releases](https://github.com/coreybutler/nvm-windows/releases)
- **Common locations**: Automatically detected in PATH

#### Unix-like Systems (macOS, Linux, WSL)
- **nvm**: Standard Node Version Manager
- **Installation paths automatically detected**:
  - `~/.nvm/nvm.sh` (default)
  - `/usr/local/share/nvm/nvm.sh` (Homebrew)
  - `/opt/nvm/nvm.sh` (system-wide)
  - `/usr/share/nvm/nvm.sh` (package manager)

## Features by Platform

### Path Handling
- **Windows**: Supports both forward slashes (`/`) and backslashes (`\`)
- **Unix-like**: Automatically converts Windows paths to Unix format
- **Quoted paths**: All paths are properly quoted to handle spaces

### Terminal Integration
- **PowerShell**: Uses `;` as command separator, supports `Write-Host`
- **Command Prompt**: Uses `&` as command separator, uses `/d` flag for `cd`
- **Unix shells**: Uses `&&` as command separator, supports standard commands

### Dependency Detection
- **ts-node**: Cross-platform installation detection using `where` (Windows) and `which` (Unix)
- **Node.js**: Automatic detection across all platforms
- **PATH handling**: Proper environment variable handling per platform

## Known Limitations

### Windows Specific
- Long path support requires Windows 10 version 1607+ with appropriate registry settings
- Some antivirus software may interfere with Node.js execution

### Unix Specific
- Fish shell requires bash fallback for nvm operations
- Some Linux distributions may require manual nvm installation

### WSL Specific
- File permissions may need adjustment for executable scripts
- Network access follows WSL networking rules

## Troubleshooting

### Common Issues

#### "ts-node not found"
**Solution**: Install ts-node globally:
```bash
# Windows (PowerShell/cmd)
npm install -g ts-node

# macOS/Linux/WSL
npm install -g ts-node
# or
sudo npm install -g ts-node
```

#### "nvm not found"
**Windows**: Install nvm-windows from official releases
**Unix**: Install nvm using curl:
```bash
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.0/install.sh | bash
```

#### Path issues with spaces
The extension automatically quotes all paths, but ensure your workspace doesn't contain special characters that might cause issues.

#### Permission errors (Linux/macOS)
```bash
# Fix npm global permissions
mkdir ~/.npm-global
npm config set prefix '~/.npm-global'
echo 'export PATH=~/.npm-global/bin:$PATH' >> ~/.bashrc
source ~/.bashrc
```

## Testing Cross-Platform Features

The extension includes platform-specific tests to ensure compatibility:

```bash
# Run all tests
npm test

# Run platform-specific tests
npm run test -- --grep "Platform Detection"
```

## Contributing

When contributing cross-platform features:

1. Test on multiple platforms (Windows, macOS, Linux)
2. Consider different shell environments
3. Use the provided utility functions in `src/utils/index.ts`
4. Add appropriate error handling for platform-specific operations
5. Update this documentation with any new platform considerations

## Platform Utility Functions

The extension provides several utility functions for cross-platform compatibility:

```typescript
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
} from './utils';
```

These functions handle platform detection, path normalization, and shell-specific command formatting automatically. 