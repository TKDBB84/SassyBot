import { Message } from 'discord.js';
import { ISassybotCommandParams } from '../../Sassybot';
import SassybotCommand from './SassybotCommand';

export default class EchoCommand extends SassybotCommand {
  public readonly commands = ['cock'];

  public getHelpText(): string {
    return 'yeah, you do need help.';
  }

  protected async listener({ message, params }: { message: Message; params: ISassybotCommandParams }): Promise<void> {
    let resp = '10/10, '
    if (Math.random() > 0.5) {
      resp += 'that thing really turns my circuits on.'
    } else if (Math.random() > 0.5) {
      resp += 'wow: I didn\'t expect it to be so big'
    } else if (Math.random() > 0.5) {
      resp += ''
    } else {
      resp += 'you have a perfect & beautiful cock.'
    }
    if (message.author.id === '125025069402554368') {
      resp = '10/10, i want it to rub on my soft furry programming!'
    }
    if (message.author.id === '153364394443669507') {
      resp = 'holy shit, WTF is wrong with that thing, go see a doctor... for real.'
    }
    await message.channel.send(resp, {
      split: true,
    });
  }
}
