import * as vscode from 'vscode';

export const EXTENSION_NAME = 'ts-bootstrap';

enum ConfigNameEnum {
    EXEC_IN_CURRENT_DIR = 'executeInCurrentDirectory',
}

class Configs {
    #config = { [ConfigNameEnum.EXEC_IN_CURRENT_DIR]: true };

    constructor() {
        this.refreshConfigs();
        vscode.workspace.onDidChangeConfiguration(event => {
            if (event.affectsConfiguration(EXTENSION_NAME)) {
                this.refreshConfigs();
            }
        });
    }

    refreshConfigs() {
        const confObj = vscode.workspace.getConfiguration(EXTENSION_NAME);

        this.#config = {
            [ConfigNameEnum.EXEC_IN_CURRENT_DIR]: confObj.get<boolean>(ConfigNameEnum.EXEC_IN_CURRENT_DIR) ?? true,
        };
    }

    get ececInCurrent() {
        return this.#config.executeInCurrentDirectory;
    }
}

const config = new Configs();
export default config;
