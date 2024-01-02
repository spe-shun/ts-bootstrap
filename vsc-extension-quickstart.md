# Welcome to your VS Code Extension

## What's in the folder

* This folder contains all of the files necessary for your extension.
* `package.json` - this is the manifest file in which you declare your extension and command.
  * The sample plugin registers a command and defines its title and command name. With this information VS Code can show the command in the command palette. It doesn’t yet need to load the plugin.
* `src/extension.ts` - this is the main file where you will provide the implementation of your command.
  * The file exports one function, `activate`, which is called the very first time your extension is activated (in this case by executing the command). Inside the `activate` function we call `registerCommand`.
  * We pass the function containing the implementation of the command as the second parameter to `registerCommand`.

## Setup

* install the recommended extensions (amodio.tsl-problem-matcher and dbaeumer.vscode-eslint)


## Get up and running straight away

* Press `F5` to open a new window with your extension loaded.
* Run your command from the command palette by pressing (`Ctrl+Shift+P` or `Cmd+Shift+P` on Mac) and typing `Hello World`.
* Set breakpoints in your code inside `src/extension.ts` to debug your extension.
* Find output from your extension in the debug console.

## Make changes

* You can relaunch the extension from the debug toolbar after changing code in `src/extension.ts`.
* You can also reload (`Ctrl+R` or `Cmd+R` on Mac) the VS Code window with your extension to load your changes.


## Explore the API

* You can open the full set of our API when you open the file `node_modules/@types/vscode/index.d.ts`.

## Run tests

* Open the debug viewlet (`Ctrl+Shift+D` or `Cmd+Shift+D` on Mac) and from the launch configuration dropdown pick `Extension Tests`.
* Press `F5` to run the tests in a new window with your extension loaded.
* See the output of the test result in the debug console.
* Make changes to `src/test/suite/extension.test.ts` or create new test files inside the `test/suite` folder.
  * The provided test runner will only consider files matching the name pattern `**.test.ts`.
  * You can create folders inside the `test` folder to structure your tests any way you want.

## Go further

* Reduce the extension size and improve the startup time by [bundling your extension](https://code.visualstudio.com/api/working-with-extensions/bundling-extension).
* [Publish your extension](https://code.visualstudio.com/api/working-with-extensions/publishing-extension) on the VS Code extension marketplace.
* Automate builds by setting up [Continuous Integration](https://code.visualstudio.com/api/working-with-extensions/continuous-integration).

## BUILD package

在 Visual Studio Code (VS Code) 中编写插件后，你可以使用 `vsce`（Visual Studio Code Extensions）工具来打包你的插件。`vsce` 是一个命令行工具，用于管理 VS Code 扩展，包括打包和发布扩展。

以下是使用 `vsce` 打包 VS Code 插件的步骤：

1. **安装 `vsce`**:
   如果你还没有安装 `vsce`，你需要先通过 npm 安装它。打开终端或命令提示符，然后运行以下命令：

   ```sh
   npm install -g vsce
   ```

2. **登录到你的发布者账户** (如果需要):
   如果你打算将插件发布到 VS Code 扩展市场，你需要创建一个发布者账户，并使用 `vsce login <publisher-name>` 命令登录。如果只是打包而不发布，这一步可以跳过。

3. **打包插件**:
   在你的插件项目根目录下，运行以下命令来打包你的插件：

   ```sh
   vsce package
   ```

   这个命令将会生成一个 `.vsix` 文件，这是 VS Code 扩展的打包格式。你可以在任何 VS Code 实例中安装这个 `.vsix` 文件，或者将其分享给其他人。

4. **（可选）发布插件**:
   如果你想将打包好的插件发布到 VS Code 扩展市场，可以使用以下命令：

   ```sh
   vsce publish
   ```

   这个命令会将你的扩展发布到你的发布者账户下。确保你已经登录到你的发布者账户，并且你的 `package.json` 文件已经正确配置。

这些就是使用 `vsce` 打包 VS Code 插件的基本步骤。在打包之前，请确保你已经测试了插件的所有功能，并且遵循了所有的最佳实践和指南。
