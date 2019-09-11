export interface ISassyBotImport {
  functions: { [key: string]: SassyBotCommand };
  help: { [key: string]: string };
}
type SassyBotImportList = ISassyBotImport[];
export type SassyBotCommand = (message: Message) => Promise<void>;
interface ISassyBotCommandList {
  [key: string]: SassyBotCommand;
}
interface IPleaseRequiredList {
  [key: string]: { id: string; lastMessage: Message | null };
}
type SassybotTrollList = Array<{ process: SassybotTrollCommand; chance: number }>;
export type SassybotTrollCommand = (message: Message) => Promise<boolean>;

import * as Discord from 'discord.js';
import { Message, MessageOptions } from 'discord.js';
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
const getSecrets: () => IClientSecrets = (): IClientSecrets => ({
  token: process.env.DISCORD_TOKEN as string,
  xivApiToken: process.env.XIV_API_TOKEN as string,
});

const sassybotReply = (message: Message, reply: string): Promise<Message | Message[]> => {
  const options: MessageOptions = {
    disableEveryone: true,
    reply: message.author,
    split: true,
  };
  return message.channel.send(reply, options);
};

const sassybotRespond = (message: Message, text: string): Promise<Message | Message[]> => {
  const options: MessageOptions = {
    disableEveryone: true,
    split: true,
  };
  return message.channel.send(text, options);
};

const getDisplayName = (message: Message): string => {
  return message.member.nickname ? message.member.nickname : message.author.username;
};

const shiftyEyes: SassybotTrollCommand = async (message) => {
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
    await sassybotRespond(message, outMessage);
    return false;
  }
  return true;
};

const aPingRee: SassybotTrollCommand = async (message) => {
  if (message.content.toLowerCase().includes(':apingree:') || message.content.toLowerCase().includes(':angeryping:')) {
    setTimeout(() => {
      sassybotReply(message, 'oh I hear you like being pinged!');
    }, Math.floor(Math.random() * 75001) + 15000);
    return false;
  }
  return true;
};

const moreDots: SassybotTrollCommand = async (message) => {
  const dotMatch = message.content.match(/(\.)+/);
  if (!dotMatch || !dotMatch.input) {
    return true;
  }
  if (dotMatch[0].toString() === dotMatch.input.toString()) {
    await sassybotRespond(message, dotMatch.input.toString() + dotMatch.input.toString());
    return false;
  }
  return true;
};

const pleaseShutUp: SassybotTrollCommand = async (message) => {
  await sassybotReply(message, 'will you please shut up?');
  return false;
};

const processPleaseStatement: SassybotTrollCommand = async (message) => {
  const authorId = getAuthorId(message);
  if (pleaseRequiredList.hasOwnProperty(authorId)) {
    const pleaseRequired = pleaseRequiredList[authorId];
    if (message.content.toLowerCase() === 'please') {
      if (pleaseRequired.lastMessage !== null) {
        await processSassybotCommand(pleaseRequired.lastMessage);
        pleaseRequiredList[authorId].lastMessage = null;
        return false;
      }
    }
  }
  return true;
};

const justSayNo: SassybotTrollCommand = async (message) => {
  if (isSassyBotCall(message)) {
    await sassybotRespond(message, 'No, Fuck you.');
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

const isSassyBotCall = (message: Message): boolean => {
  return message.content.toLowerCase().startsWith('!sassybot ') || message.content.toLowerCase().startsWith('!sb ');
};

const spamFunction: SassyBotCommand = async (message) => {
  const authorId = getAuthorId(message);
  if (authorId === Users.Sasner.id || authorId === Users.Verian.id || authorId === Users.Tyr.id) {
    channelList.set(message.guild.id, message.channel.id);
    db.removeSpamChannel(message.guild.id);
    db.addSpamChannel(message.guild.id, message.channel.id);
    await sassybotRespond(message, "Ok, I'll spam this channel");
  } else {
    await sassybotRespond(message, 'This functionality is limited to Sasner & server owners');
  }
};

const censusFunction: SassyBotCommand = async (message) => {
  const wordArray = message.content.split(' ');
  let firstWord;
  if (wordArray.length >= 2) {
    firstWord = wordArray[2];
  }

  switch (firstWord) {
    case '2019':
    default:
      await sassybotRespond(message, 'https://bit.ly/2IFwzke  -- Thanks to Astra');
      break;
  }
  return;
};

const helpFunction: SassyBotCommand = async (message) => {
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
  await sassybotRespond(message, reply);
};

const pingFunction: SassyBotCommand = async (message) => {
  await sassybotReply(message, 'pong');
};
const echoFunction: SassyBotCommand = async (message) => {
  await sassybotRespond(message, message.content);
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

const getAuthorId = (message: Message): string => {
  return message.author.id;
};

const processSassybotCommand = async (message: Message): Promise<void> => {
  if (!isSassyBotCall(message)) {
    return;
  }

  const authorId = getAuthorId(message);

  if (pleaseRequiredList.hasOwnProperty(authorId)) {
    if (!message.content.endsWith(' please')) {
      pleaseRequiredList[authorId].lastMessage = message;
      await sassybotRespond(message, 'only if you say "please"');
      return;
    } else {
      message.content = message.content.slice(0, -1 * ' please'.length);
    }
  }

  const parsed = message.content.toLowerCase().split(' ');
  if (chatFunctions.hasOwnProperty(parsed[1])) {
    await chatFunctions[parsed[1]](message);
  } else {
    await sassybotRespond(message, "Sorry I Don't Know That Command");
  }
};

const messageEventHandler: SassyBotCommand = async (message) => {
  const authorId: string = getAuthorId(message);
  const isFromSassyBot = authorId === Users.Sassybot.id;
  if (!isFromSassyBot) {
    const isAbsentOrPromoteRequest = await resumeAbsentOrPromote(message);
    if (isAbsentOrPromoteRequest) {
      return;
    }
    const isNewMemberMessage = await newMemberListener(message);
    if (isNewMemberMessage) {
      return;
    }
    let randomNumber: number;
    if (authorId !== Users.Sasner.id) {
      for (let i = 0, iMax = preProcessTrollFunctions.length; i < iMax; i++) {
        randomNumber = Math.random();
        if (randomNumber < preProcessTrollFunctions[i].chance) {
          const continueProcessing = await preProcessTrollFunctions[i].process(message);
          if (!continueProcessing) {
            return;
          }
        }
      }
    }
    await processSassybotCommand(message);
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
