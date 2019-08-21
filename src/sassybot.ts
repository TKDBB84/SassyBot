export type SassyBotImport = { functions: { [key: string]: SassyBotCommand }, help: { [key: string]: string } }
type SassyBotImportList = SassyBotImport[]
export type SassyBotCommand = (message: Message) => void;
type SassyBotCommandList = { [key: string]: SassyBotCommand };
type PleaseRequiredList = { [key: string]: { id: string, lastMessage: Message | null } };
type SassybotTrollList = { process: SassybotTrollCommand, chance: number }[]
export type SassybotTrollCommand = (message: Message) => boolean;

import * as fs from "fs";
import * as Discord from 'discord.js';
import {Message, MessageOptions} from "discord.js";
import Users from './Users';
import VoiceLogHandler from './VoiceLog'
import SassyDb from './SassyDb'

import DiceFunctions from './Dice';
import QuoteFunctions from './Quotes';
import {AbsentOrPromoteFunctions, resumeAbsentOrPromote} from './AbsentPromote';
import {newMemberJoinedCallback, newMemberListener, setNewUserWorkflow} from './NewUserManager';

const db = new SassyDb();
const client = new Discord.Client();
const channelList = db.getSpamChannelMap();
const pleaseRequiredList: PleaseRequiredList = {};
const importedFunctions: SassyBotImportList = [DiceFunctions, QuoteFunctions, AbsentOrPromoteFunctions];

type client_secrets = { token: string, xivApiToken: string }
const getSecrets: () => client_secrets = (): client_secrets => {
    const fileData = fs.readFileSync("/home/nodebot/src/client_secrets.json");
    return JSON.parse(fileData.toString());
};

const sassybotReply: (message: Message, reply: string) => void = (message: Message, reply: string): void => {
    const options: MessageOptions = {
        disableEveryone: true,
        split: true,
        reply: message.author,
    };
    message.channel.send(reply, options).catch(console.error);
};

const sassybotRespond: (message: Message, reply: string) => void = (message: Message, text: string): void => {
    const options: MessageOptions = {
        disableEveryone: true,
        split: true
    };
    message.channel.send(text, options).catch(console.error);
};

const getDisplayName: (message: Message) => string = function (message: Message): string {
    return message.member.nickname ? message.member.nickname : message.author.username;
};

const shiftyEyes: SassybotTrollCommand = function shiftyEyes(message: Message): boolean {
    let outMessage = "";
    const leftEyes = /.*<(\s*.\s*)<.*/;
    const rightEyes = /.*>(\s*.\s*)>.*/;

    const message_left = message.content.match(leftEyes);
    const message_right = message.content.match(rightEyes);
    let left_response = "",
        left_eyes = "",
        right_response = "",
        right_eyes = "";
    if (message_left) {
        left_eyes = `<${message_left[1]}<`;
        left_response = `>${message_left[1]}>`;
    }
    if (message_right) {
        right_eyes = `>${message_right[1]}>`;
        right_response = `<${message_right[1]}<`;
    }

    if (message_left && message_right) {
        if (
            message.content.indexOf(left_eyes) < message.content.indexOf(right_eyes)
        ) {
            outMessage = `${left_response} ${right_response}`;
        } else {
            outMessage = `${right_response} ${left_response}`;
        }
    } else if (message_left) {
        outMessage = left_response;
    } else if (message_right) {
        outMessage = right_response;
    }

    if (outMessage === "") {
        const author_nickname = getDisplayName(message);
        const author_left = author_nickname.match(leftEyes);
        const author_right = author_nickname.match(rightEyes);
        if (author_left) {
            outMessage =
                `>${author_left[1]}> (but only because you named yourself that)`;
        } else if (author_right) {
            outMessage =
                `<${author_right[1]}< (but only because you named yourself that)`;
        }
    }

    if (outMessage !== "") {
        sassybotRespond(message, outMessage);
        return false;
    }
    return true;
};

const aPingRee: SassybotTrollCommand = (message: Message): boolean => {
    if (
        message.content.toLowerCase().includes(":apingree:") ||
        message.content.toLowerCase().includes(":angeryping:")
    ) {
        setTimeout(() => {
            sassybotReply(message, "oh I hear you like being pinged!");
        }, Math.floor(Math.random() * 75001) + 15000);
        return false;
    }
    return true;
};

const moreDots: SassybotTrollCommand = (message: Message): boolean => {
    const dotMatch = message.content.match(/(\.)+/);
    if (!dotMatch || !dotMatch['input']) {
        return true;
    }
    if (dotMatch[0].toString() === dotMatch['input'].toString()) {
        sassybotRespond(message, dotMatch['input'].toString() + dotMatch['input'].toString());
        return false;
    }
    return true;
};

const pleaseShutUp: SassybotTrollCommand = (message: Message): boolean => {
    sassybotReply(message, "will you please shut up?");
    return false;
};

const processPleaseStatement: SassybotTrollCommand = (message: Message): boolean => {
    const author_id = getAuthorId(message);
    if (pleaseRequiredList.hasOwnProperty(author_id)) {
        const pleaseRequired = pleaseRequiredList[author_id];
        if (message.content.toLowerCase() === "please") {
            if (pleaseRequired.lastMessage !== null) {
                processSassybotCommand(pleaseRequired.lastMessage);
                pleaseRequiredList[author_id].lastMessage = null;
                return false;
            }
        }
    }
    return true;
};

const justSayNo: SassybotTrollCommand = (message: Message): boolean => {
    if (isSassyBotCall(message)) {
        sassybotRespond(message, 'No, Fuck you.');
        return false;
    }
    return true;
};

const preProcessTrollFunctions: SassybotTrollList = [
    {
        process: shiftyEyes,
        chance: 0.0
    },
    {
        process: aPingRee,
        chance: 1.0
    },
    {
        process: moreDots,
        chance: 0.0
    },
    {
        process: pleaseShutUp,
        chance: 0.0
    },
    {
        process: processPleaseStatement,
        chance: 1.0
    },
    {
        process: justSayNo,
        chance: 0.00
    }
];

const isSassyBotCall: (message: Message) => boolean = function (message: Message): boolean {
    return message.content.toLowerCase().startsWith("!sassybot") ||
        message.content.toLowerCase().startsWith("!sb");
};

const spamFunction: SassyBotCommand = (message: Message): void => {
    const author_id = getAuthorId(message);
    if (author_id === Users.Sasner.id || author_id === Users.Verian.id || author_id === Users.Tyr.id) {
        channelList.set(message.guild.id, message.channel.id);
        db.removeSpamChannel(message.guild.id);
        db.addSpamChannel(message.guild.id, message.channel.id);
        sassybotRespond(message, "Ok, I'll spam this channel");
    } else {
        sassybotRespond(message, "This functionality is limited to Sasner & server owners");
    }
};

const censusFunction: SassyBotCommand = (message: Message): void => {
    let wordArray = message.content.split(" ");
    let firstWord;
    if (wordArray.length >= 2) {
        firstWord = wordArray[2];
    }

    switch (firstWord) {
        case '2019':
        default:
            sassybotRespond(message, 'https://bit.ly/2IFwzke  -- Thanks to Astra');
            break
    }
    return
};

const helpFunction: SassyBotCommand = (message: Message): void => {
    let wordArray = message.content.split(" ");
    let firstWord;
    if (wordArray.length < 2) {
        firstWord = "default";
    } else {
        firstWord = wordArray[2];
    }
    let commandList: { [p: string]: string };
    commandList = {
        echo:
            "usage: `!{sassybot|sb} echo {message}` -- I reply with the same message you sent me, Sasner generally uses this for debugging",
        help:
            "usage: `!{sassybot|sb} help [command]` -- I displays a list of commands, and can take a 2nd argument for more details of a command",
        ping:
            'usage: `!{sassybot|sb} ping` -- I reply with "pong" this is a good test to see if i\'m listening at all',
        spam:
            "usage: `!{sassybot|sb}` spam -- this cause me to spam users enter, leaving, or changing voice rooms into the channel this command was specified",
        testnewuser:
            'dfsad'
    };

    for (let j = 0; j < importedFunctions.length; j++) {
        if (importedFunctions[j].hasOwnProperty("help")) {
            commandList = Object.assign({}, importedFunctions[j].help, commandList);
        }
    }

    const orderedList: { [key: string]: string } = {};
    Object.keys(commandList)
        .sort()
        .forEach(key => {
            orderedList[key] = commandList[key];
        });

    let commands = Object.keys(orderedList);
    let reply = "";
    if (commands.includes(firstWord)) {
        reply = commandList[firstWord];
    } else {
        reply = `Available commands are:` + '\n' + `${JSON.stringify(commands)}` + '\n' +
            `for more information, you can specify \`!{sassybot|sb} help [command]\` to get more information about that command`;
    }
    sassybotRespond(message, reply);
};

const pingFunction: SassyBotCommand = (message: Message): void => {
    sassybotReply(message, "pong");
};
const echoFunction: SassyBotCommand = (message: Message): void => {
    sassybotRespond(message, message.content);
};

let chatFunctions: SassyBotCommandList = {
    census: censusFunction,
    echo: echoFunction,
    help: helpFunction,
    ping: pingFunction,
    spam: spamFunction,
    testnewuser: (message: Message) => {
        setNewUserWorkflow(message);
    }
};

for (let j = 0; j < importedFunctions.length; j++) {
    chatFunctions = Object.assign(
        {},
        importedFunctions[j].functions,
        chatFunctions
    );
}

const getAuthorId: (message: Message) => string = (message: Message): string => {
    return message.author.id;
};

const processSassybotCommand: (message: Message) => void = function processSassybotCommand(message: Message): void {
    if (!isSassyBotCall(message)) return;

    const author_id = getAuthorId(message);

    if (pleaseRequiredList.hasOwnProperty(author_id)) {
        if (!message.content.endsWith(" please")) {
            pleaseRequiredList[author_id].lastMessage = message;
            sassybotRespond(message, 'only if you say "please"');
            return;
        } else {
            message.content = message.content.slice(0, -1 * " please".length);
        }
    }

    let parsed = message.content.toLowerCase().split(" ");
    if (chatFunctions.hasOwnProperty(parsed[1])) {
        chatFunctions[parsed[1]](message);
    } else {
        sassybotRespond(message, "Sorry I Don't Know That Command");
    }
};

const messageEventHandler: (message: Message) => void = (message: Message): void => {
    const author_id: string = getAuthorId(message);
    let isFromSassyBot = author_id === Users.Sassybot.id;
    if (!isFromSassyBot) {
        if (message.channel.type === 'dm') {
            // sassybot DM things
            resumeAbsentOrPromote(message);
            return;
        } else {
            const isNewMemberMessage = newMemberListener(message);
            if (isNewMemberMessage) {
                return;
            }
            let random_number: number;
            if (author_id !== Users.Sasner.id) {
                for (let i = 0, iMax = preProcessTrollFunctions.length; i < iMax; i++) {
                    random_number = Math.random();
                    if (random_number < preProcessTrollFunctions[i].chance) {
                        const continueProcessing = preProcessTrollFunctions[i].process(message);
                        if (!continueProcessing) {
                            return;
                        }
                    }
                }
            }
            processSassybotCommand(message);
        }
    }
};

client.on("voiceStateUpdate", ((oldMember, newMember) => {
    VoiceLogHandler(client, channelList, oldMember, newMember);
}));
client.on("message", messageEventHandler);
client.on("ready", () => console.log("I am ready!"));
client.on('guildMemberAdd', newMemberJoinedCallback);

client.login(getSecrets().token)
    .then(console.log)
    .catch(console.error);
