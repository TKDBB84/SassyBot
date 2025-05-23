import { Message } from 'discord.js';
import { ISassybotCommandParams } from '../../Sassybot';
import SassybotCommand from './SassybotCommand';

export default class RollCommand extends SassybotCommand {
  private static parseDice(args: string): { num: number; sides: number } {
    const result = /^\s*(\d+)d(\d+).*$/i.exec(args);

    let ret = {
      num: 0,
      sides: 0,
    };

    if (result && result.length === 3) {
      ret = {
        num: parseInt(result[1], 10),
        sides: parseInt(result[2], 10),
      };
    }

    if (ret.num > 420) {
      ret.num = 420;
    }

    if (ret.sides > 420) {
      ret.sides = 420;
    }

    return ret;
  }

  private static rollDice(parsedDice: { num: number; sides: number }): number[] {
    const numberOfDice = parsedDice.num;
    const numberOfSides = parsedDice.sides;

    if (numberOfDice === 0) {
      return [];
    }
    if (numberOfSides === 0) {
      return Array(numberOfDice).fill(0) as number[];
    }

    const diceRolls = [];
    for (let i = 0; i < numberOfDice; i++) {
      diceRolls.push(Math.floor(Math.random() * numberOfSides) + 1);
    }
    return diceRolls;
  }

  private static parseKeepOrDrops(args: string): { drop: boolean; keep: boolean; numDice: number } {
    const result = /^\s*\d+d\d+([d|k])(\d+).*$/i.exec(args);

    let ret = {
      drop: false,
      keep: false,
      numDice: 0,
    };

    if (result && result.length === 3) {
      ret = {
        drop: result[1].toLowerCase() === 'd',
        keep: result[1].toLowerCase() === 'k',
        numDice: parseInt(result[2], 10),
      };
    }
    return ret;
  }

  private static parseStaticAdditions(args: string): { minus: boolean; constant: number; plus: boolean } {
    const result = /^.*([+-])\s*(\d+)$/i.exec(args);

    let ret = {
      constant: 0,
      minus: false,
      plus: false,
    };

    if (result && result.length === 3) {
      ret = {
        constant: parseInt(result[2], 10),
        minus: result[1].trim() === '-',
        plus: result[1].trim() === '+',
      };
    }

    return ret;
  }

  private static actionKeepOrDrops(
    keepOrDrop: { drop: boolean; keep: boolean; numDice: number },
    rolls: number[],
  ): { dropped: number[]; kept: number[] } {
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
      dropped: RollCommand.shuffle(dropped),
      kept: RollCommand.shuffle(kept),
    };
  }

  private static shuffle(arr: number[]): number[] {
    return arr
      .map((a) => [Math.random(), a])
      .sort((a, b) => a[0] - b[0])
      .map((a) => a[1]);
  }

  private static rollFunction(args: string) {
    const parsed = RollCommand.parseDice(args);
    const keptAndDropped = RollCommand.actionKeepOrDrops(
      RollCommand.parseKeepOrDrops(args),
      RollCommand.rollDice(parsed),
    );

    const additions = RollCommand.parseStaticAdditions(args);
    let total = 0;

    if (keptAndDropped.kept.length > 0) {
      total = keptAndDropped.kept.reduce((carry, num) => carry + num);
    }

    let replyMessage = '';
    if (parsed.num === 69 || parsed.sides === 69) {
      replyMessage += '(nice) ';
    }

    if (parsed.num === 420 || parsed.sides === 420) {
      replyMessage += '(blaze-it) ';
    }

    replyMessage += '[ ';
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
      replyMessage += `${additions.plus ? ' + ' : ''}${additions.minus ? ' - ' : ''}${additions.constant}`;
      if (additions.minus) {
        additions.constant *= -1;
      }
    }
    total += additions.constant;
    return replyMessage + ' => ' + total.toString();
  }
  public readonly commands = ['roll', 'rolls', 'r'];

  protected getHelpText(): string {
    return 'usage: `!{sassybot|sb} roll {int: number of dies}d{int: number of sides}[k|d{number of dice to keep/drop}][+|-]{constant to add/sub from total}]` -- I roll the specified number of dice, with the specified number of sides, and compute the sum total, as well as list each roll';
  }

  protected async listener({ message, params }: { message: Message; params: ISassybotCommandParams }): Promise<void> {
    if (!message.channel.isSendable()) {
      return;
    }
    const response = RollCommand.rollFunction(params.args);
    await message.channel.send({ content: response, reply: { messageReference: message } });
  }
}
