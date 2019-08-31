import EventEmitter = NodeJS.EventEmitter;
import {Client, Message} from "discord.js";
import * as fs from "fs";

export module SassyBot {

    export type Command = (message: Message) => void;
    export type Import = { functions: { [key: string]: Command }, help: { [key: string]: string } }
    export type ImportList = Import[]
    export type CommandList = { [key: string]: Command };
    export type PleaseRequiredList = { [key: string]: { id: string, lastMessage: Message | null } };
    export type TrollCommand = (message: Message) => boolean;
    export type TrollList = { process: TrollCommand, chance: number }[]
    type client_secrets = { token: string, xivApiToken: string }

    const getSecrets: () => client_secrets = (): client_secrets => {
        const fileData = fs.readFileSync("/home/nodebot/src/client_secrets.json");
        return JSON.parse(fileData.toString());
    };


    export class SassyBot extends EventEmitter {
        protected discordClient: Client;

        constructor() {
            super();
            this.discordClient = new Client();
            this.connect()
        }

        private connect(): void {
            this.discordClient.login(getSecrets().token)
                .then(console.log)
                .catch(console.error);
        }
    }

}
