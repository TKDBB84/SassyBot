export interface ISassyBotImport {
  functions: { [key: string]: SassyBotCommand };
  help: { [key: string]: string };
}
type SassyBotImportList = ISassyBotImport[];
export type SassyBotCommand = (message: Message) => void;
interface ISassyBotCommandList {
  [key: string]: SassyBotCommand;
}
interface IPleaseRequiredList {
  [key: string]: { id: string; lastMessage: Message | null };
}
type SassybotTrollList = Array<{ process: SassybotTrollCommand; chance: number }>;
export type SassybotTrollCommand = (message: Message) => boolean;

import * as Discord from 'discord.js';
import { Message, MessageOptions } from 'discord.js';
import * as fs from 'fs';
import SassyDb from './SassyDb';
import Users from './Users';
import VoiceLogHandler from './VoiceLog';

import { AbsentOrPromoteFunctions, resumeAbsentOrPromote } from './AbsentPromote';
import { ClaimUser } from './CoTMembers';
import DiceFunctions from './Dice';
import { newMemberJoinedCallback, newMemberListener } from './NewUserManager';
import QuoteFunctions from './Quotes';

const db = new SassyDb();
const client = new Discord.Client();
const channelList = db.getSpamChannelMap();
const pleaseRequiredList: IPleaseRequiredList = {};
const importedFunctions: SassyBotImportList = [DiceFunctions, QuoteFunctions, AbsentOrPromoteFunctions, ClaimUser];

interface IClientSecrets {
  token: string;
  xivApiToken: string;
}
const getSecrets: () => IClientSecrets = (): IClientSecrets => {
  const fileData = fs.readFileSync('/home/nodebot/src/client_secrets.json');
  return JSON.parse(fileData.toString());
};

const sassybotReply: (message: Message, reply: string) => void = (message: Message, reply: string): void => {
  const options: MessageOptions = {
    disableEveryone: true,
    reply: message.author,
    split: true,
  };
  message.channel.send(reply, options).catch(console.error);
};

const sassybotRespond: (message: Message, reply: string) => void = (message: Message, text: string): void => {
  const options: MessageOptions = {
    disableEveryone: true,
    split: true,
  };
  message.channel.send(text, options).catch(console.error);
};

const getDisplayName: (message: Message) => string = (message: Message): string => {
  return message.member.nickname ? message.member.nickname : message.author.username;
};

const shiftyEyes: SassybotTrollCommand = (message: Message): boolean => {
  let outMessage = '';
  const leftEyesExp = /.*<(\s*.\s*)<.*/;
  const rightEyesExp = /.*>(\s*.\s*)>.*/;

  const messageLeft = message.content.match(leftEyesExp);
  const messageRight = message.content.match(rightEyesExp);
  let leftResponse = '';
  let leftEyes = '';
  let rightResponse = '';
  let rightEyes = '';
  if (messageLeft) {
    leftEyes = `<${messageLeft[1]}<`;
    leftResponse = `>${messageLeft[1]}>`;
  }
  if (messageRight) {
    rightEyes = `>${messageRight[1]}>`;
    rightResponse = `<${messageRight[1]}<`;
  }

  if (messageLeft && messageRight) {
    if (message.content.indexOf(leftEyes) < message.content.indexOf(rightEyes)) {
      outMessage = `${leftResponse} ${rightResponse}`;
    } else {
      outMessage = `${rightResponse} ${leftResponse}`;
    }
  } else if (messageLeft) {
    outMessage = leftResponse;
  } else if (messageRight) {
    outMessage = rightResponse;
  }

  if (outMessage === '') {
    const authorNickname = getDisplayName(message);
    const authorLeft = authorNickname.match(leftEyesExp);
    const authorRight = authorNickname.match(rightEyesExp);
    if (authorLeft) {
      outMessage = `>${authorLeft[1]}> (but only because you named yourself that)`;
    } else if (authorRight) {
      outMessage = `<${authorRight[1]}< (but only because you named yourself that)`;
    }
  }

  if (outMessage !== '') {
    sassybotRespond(message, outMessage);
    return false;
  }
  return true;
};

const aPingRee: SassybotTrollCommand = (message: Message): boolean => {
  if (message.content.toLowerCase().includes(':apingree:') || message.content.toLowerCase().includes(':angeryping:')) {
    setTimeout(() => {
      sassybotReply(message, 'oh I hear you like being pinged!');
    }, Math.floor(Math.random() * 75001) + 15000);
    return false;
  }
  return true;
};

const moreDots: SassybotTrollCommand = (message: Message): boolean => {
  const dotMatch = message.content.match(/(\.)+/);
  if (!dotMatch || !dotMatch.input) {
    return true;
  }
  if (dotMatch[0].toString() === dotMatch.input.toString()) {
    sassybotRespond(message, dotMatch.input.toString() + dotMatch.input.toString());
    return false;
  }
  return true;
};

const pleaseShutUp: SassybotTrollCommand = (message: Message): boolean => {
  sassybotReply(message, 'will you please shut up?');
  return false;
};

const processPleaseStatement: SassybotTrollCommand = (message: Message): boolean => {
  const authorId = getAuthorId(message);
  if (pleaseRequiredList.hasOwnProperty(authorId)) {
    const pleaseRequired = pleaseRequiredList[authorId];
    if (message.content.toLowerCase() === 'please') {
      if (pleaseRequired.lastMessage !== null) {
        processSassybotCommand(pleaseRequired.lastMessage);
        pleaseRequiredList[authorId].lastMessage = null;
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
    chance: 0.0,
    process: shiftyEyes,
  },
  {
    chance: 1.0,
    process: aPingRee,
  },
  {
    chance: 0.0,
    process: moreDots,
  },
  {
    chance: 0.0,
    process: pleaseShutUp,
  },
  {
    chance: 1.0,
    process: processPleaseStatement,
  },
  {
    chance: 0.0,
    process: justSayNo,
  },
];

const isSassyBotCall: (message: Message) => boolean = (message: Message): boolean => {
  return message.content.toLowerCase().startsWith('!sassybot') || message.content.toLowerCase().startsWith('!sb');
};

const spamFunction: SassyBotCommand = (message: Message): void => {
  const authorId = getAuthorId(message);
  if (authorId === Users.Sasner.id || authorId === Users.Verian.id || authorId === Users.Tyr.id) {
    channelList.set(message.guild.id, message.channel.id);
    db.removeSpamChannel(message.guild.id);
    db.addSpamChannel(message.guild.id, message.channel.id);
    sassybotRespond(message, "Ok, I'll spam this channel");
  } else {
    sassybotRespond(message, 'This functionality is limited to Sasner & server owners');
  }
};

const censusFunction: SassyBotCommand = (message: Message): void => {
  const wordArray = message.content.split(' ');
  let firstWord;
  if (wordArray.length >= 2) {
    firstWord = wordArray[2];
  }

  switch (firstWord) {
    case '2019':
    default:
      sassybotRespond(message, 'https://bit.ly/2IFwzke  -- Thanks to Astra');
      break;
  }
  return;
};

const helpFunction: SassyBotCommand = (message: Message): void => {
  const wordArray = message.content.split(' ');
  let firstWord;
  if (wordArray.length < 2) {
    firstWord = 'default';
  } else {
    firstWord = wordArray[2];
  }
  let commandList: { [p: string]: string };
  commandList = {
    echo:
      'usage: `!{sassybot|sb} echo {message}` -- I reply with the same message you sent me, Sasner generally uses this for debugging',
    help:
      'usage: `!{sassybot|sb} help [command]` -- I displays a list of commands, and can take a 2nd argument for more details of a command',
    ping: 'usage: `!{sassybot|sb} ping` -- I reply with "pong" this is a good test to see if i\'m listening at all',
    spam:
      'usage: `!{sassybot|sb}` spam -- this cause me to spam users enter, leaving, or changing voice rooms into the channel this command was specified',
  };

  for (const importedFunction of importedFunctions) {
    if (importedFunction.hasOwnProperty('help')) {
      commandList = Object.assign({}, importedFunction.help, commandList);
    }
  }

  const orderedList: { [key: string]: string } = {};
  Object.keys(commandList)
    .sort()
    .forEach((key) => {
      orderedList[key] = commandList[key];
    });

  const commands = Object.keys(orderedList);
  let reply = '';
  if (commands.includes(firstWord)) {
    reply = commandList[firstWord];
  } else {
    reply =
      `Available commands are:` +
      '\n' +
      `${JSON.stringify(commands)}` +
      '\n' +
      `for more information, you can specify \`!{sassybot|sb} help [command]\` to get more information about that command`;
  }
  sassybotRespond(message, reply);
};

const pingFunction: SassyBotCommand = (message: Message): void => {
  sassybotReply(message, 'pong');
};
const echoFunction: SassyBotCommand = (message: Message): void => {
  sassybotRespond(message, message.content);
};

let chatFunctions: ISassyBotCommandList = {
  census: censusFunction,
  echo: echoFunction,
  help: helpFunction,
  ping: pingFunction,
  spam: spamFunction,
};

for (const importedFunction of importedFunctions) {
  chatFunctions = Object.assign({}, importedFunction.functions, chatFunctions);
}

const getAuthorId: (message: Message) => string = (message: Message): string => {
  return message.author.id;
};

const processSassybotCommand: (message: Message) => void = (message: Message): void => {
  if (!isSassyBotCall(message)) {
    return;
  }

  const authorId = getAuthorId(message);

  if (pleaseRequiredList.hasOwnProperty(authorId)) {
    if (!message.content.endsWith(' please')) {
      pleaseRequiredList[authorId].lastMessage = message;
      sassybotRespond(message, 'only if you say "please"');
      return;
    } else {
      message.content = message.content.slice(0, -1 * ' please'.length);
    }
  }

  const parsed = message.content.toLowerCase().split(' ');
  if (chatFunctions.hasOwnProperty(parsed[1])) {
    chatFunctions[parsed[1]](message);
  } else {
    sassybotRespond(message, "Sorry I Don't Know That Command");
  }
};

const messageEventHandler: (message: Message) => void = (message: Message): void => {
  const authorId: string = getAuthorId(message);
  const isFromSassyBot = authorId === Users.Sassybot.id;
  if (!isFromSassyBot) {
    if (resumeAbsentOrPromote(message)) {
      return;
    }
    const isNewMemberMessage = newMemberListener(message);
    if (isNewMemberMessage) {
      return;
    }
    let randomNumber: number;
    if (authorId !== Users.Sasner.id) {
      for (let i = 0, iMax = preProcessTrollFunctions.length; i < iMax; i++) {
        randomNumber = Math.random();
        if (randomNumber < preProcessTrollFunctions[i].chance) {
          const continueProcessing = preProcessTrollFunctions[i].process(message);
          if (!continueProcessing) {
            return;
          }
        }
      }
    }
    processSassybotCommand(message);
  }
};

client.on('voiceStateUpdate', (oldMember, newMember) => {
  VoiceLogHandler(client, channelList, oldMember, newMember);
});
client.on('message', messageEventHandler);
client.on('ready', () => console.log('I am ready!'));
client.on('guildMemberAdd', newMemberJoinedCallback);

client
  .login(getSecrets().token)
  .then(console.log)
  .catch(console.error);
