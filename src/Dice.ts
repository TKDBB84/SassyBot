import { Message, MessageOptions } from 'discord.js';
import { SassyBotCommand, SassyBotImport } from './sassybot';

const sassybotReply: (message: Message, reply: string) => void = (
  message: Message,
  reply: string
): void => {
  const options: MessageOptions = {
    disableEveryone: true,
    split: true,
    reply: message.author
  };
  message.channel.send(reply, options).catch(console.error);
};

/**
 *
 * @param message
 * @returns {{num: number, sides: number}}
 */
const parseDice: (message: Message) => { num: number; sides: number } = (
  message: Message
): { num: number; sides: number } => {
  const parsedMessage = message.content.split(' ')[2];
  const result = parsedMessage.match(/^\s*(\d+)d(\d+).*$/i);

  let ret = {
    num: 0,
    sides: 0
  };

  if (result && result.length === 3) {
    ret = {
      num: parseInt(result[1], 10),
      sides: parseInt(result[2], 10)
    };
  }

  if (ret.num > 300) {
    ret.num = 300;
  }

  if (ret.sides > 300) {
    ret.sides = 300;
  }

  return ret;
};

/**
 * @param parsedDice {{num: number, sides: number}}
 * @returns array
 */
const rollDice: (parsedDice: {
  num: number;
  sides: number;
}) => number[] = (parsedDice: { num: number; sides: number }): number[] => {
  const numberOfDice = parsedDice.num;
  const numberOfSides = parsedDice.sides;

  if (numberOfDice === 0) {
    return [];
  }
  if (numberOfSides === 0) {
    return Array(numberOfDice).fill(0);
  }

  let diceRolls = [];
  for (let i = 0; i < numberOfDice; i++) {
    diceRolls.push(Math.floor(Math.random() * numberOfSides) + 1);
  }
  return diceRolls;
};

/**
 * @param message
 * @returns {{drop: boolean, keep: boolean, numDice: number}}
 */
const parseKeepOrDrops: (
  message: Message
) => { drop: boolean; keep: boolean; numDice: number } = (
  message: Message
): { drop: boolean; keep: boolean; numDice: number } => {
  const parsedMessage = message.content.split(' ')[2];
  const result = parsedMessage.match(/^\s*\d+d\d+([d|k])(\d+).*$/i);

  let ret = {
    keep: false,
    drop: false,
    numDice: 0
  };

  if (result && result.length === 3) {
    ret = {
      keep: result[1].toLowerCase() === 'k',
      drop: result[1].toLowerCase() === 'd',
      numDice: parseInt(result[2], 10)
    };
  }
  return ret;
};

const actionKeepOrDrops: (
  keepOrDrop: { drop: boolean; keep: boolean; numDice: number },
  rolls: number[]
) => { dropped: number[]; kept: number[] } = (
  keepOrDrop: { drop: boolean; keep: boolean; numDice: number },
  rolls: number[]
): { dropped: number[]; kept: number[] } => {
  const numDiceToAction = keepOrDrop.numDice;
  const sortedRolls = rolls.sort((a, b) => a - b);
  let kept = sortedRolls;
  let dropped: number[] = [];

  if (numDiceToAction > 0) {
    if (keepOrDrop.keep) {
      if (numDiceToAction < rolls.length) {
        kept = sortedRolls.reverse().splice(0, numDiceToAction);
        dropped = sortedRolls;
      }
    } else if (keepOrDrop.drop) {
      if (numDiceToAction > rolls.length) {
        kept = [];
        dropped = rolls;
      } else {
        dropped = sortedRolls.splice(0, numDiceToAction);
        kept = sortedRolls;
      }
    }
  }

  return {
    kept: shuffle(kept),
    dropped: shuffle(dropped)
  };
};

/**
 *
 * @param arr
 */
const shuffle: (arr: number[]) => number[] = (arr: number[]): number[] =>
  arr
    .map((a) => [Math.random(), a])
    .sort((a, b) => a[0] - b[0])
    .map((a) => a[1]);

/**
 * @param message
 * @returns {{minus: boolean, constant: number, plus: boolean}}
 */
const parseStaticAdditions: (
  message: Message
) => { minus: boolean; constant: number; plus: boolean } = (
  message: Message
): { minus: boolean; constant: number; plus: boolean } => {
  const parsedMessage = message.content.split(' ')[2];
  const result = parsedMessage.match(/^.*([+\-])\s*(\d+)$/i);

  let ret = {
    plus: false,
    minus: false,
    constant: 0
  };

  if (result && result.length === 3) {
    ret = {
      plus: result[1].trim() === '+',
      minus: result[1].trim() === '-',
      constant: parseInt(result[2], 10)
    };
  }

  return ret;
};

const rollFunction: SassyBotCommand = (message: Message): void => {
  let keptAndDropped = actionKeepOrDrops(
    parseKeepOrDrops(message),
    rollDice(parseDice(message))
  );
  let additions = parseStaticAdditions(message);
  let total = 0;

  if (keptAndDropped.kept.length > 0) {
    total = keptAndDropped.kept.reduce((total, num) => total + num);
  }

  let replyMessage = '[ ';
  for (let i = 0; i < keptAndDropped.kept.length; i++) {
    if (i > 0) {
      replyMessage += ', ';
    }
    replyMessage += keptAndDropped.kept[i].toString();
  }

  for (let i = 0; i < keptAndDropped.dropped.length; i++) {
    if (keptAndDropped.kept.length > 0 || i > 0) {
      replyMessage += ', ';
    }
    replyMessage += '~~' + keptAndDropped.dropped[i].toString() + '~~';
  }
  replyMessage += ' ] ';

  if (additions.constant > 0 && (additions.plus || additions.minus)) {
    replyMessage +=
      (additions.plus ? ' + ' : '') +
      (additions.minus ? ' - ' : '') +
      additions.constant;
    if (additions.minus) {
      additions.constant *= -1;
    }
  }
  total += additions.constant;
  replyMessage += ' => ' + total.toString();
  sassybotReply(message, replyMessage);
};

const diceExport: SassyBotImport = {
  functions: {
    roll: rollFunction
  },
  help: {
    roll:
      'usage: `!{sassybot|sb} roll {int: number of dies}d{int: number of sides}[k|d{number of dice to keep/drop}][+|-]{constant to add/sub from total}]` -- I roll the specified number of dice, with the specified number of sides, and compute the sum total, as well as list each roll'
  }
};

export default diceExport;
