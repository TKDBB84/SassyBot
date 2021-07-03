import { Message } from 'discord.js';
import SassybotCommand from './SassybotCommand';

export default class CockCommand extends SassybotCommand {
  public readonly commands = ['cock'];

  public getHelpText(): string {
    return 'yeah, you do really need help.';
  }

  protected async listener({ message }: { message: Message }): Promise<void> {
    const phrases = [
      '8/10, a little firm but gets the job done',
      '10/10, nice cock bro',
      '10/10, I <3 three inchers',
      '10/10, reminds me of a chicken nugget',
      '10/10, A+ Shape',
      'nice cock bro. a little on the small side, but the shape is overall pretty symmetrical, and your balls have just the right amount of hair. the council rates it 7/10.',
      '10/10, that thing really turns my circuits on.',
      "10/10, wow: I didn't expect it to be so big",
      '5/10, perfectly average in every way',
      '4/10, all wrinkly & moist',
      '10/10, you have a perfect & beautiful cock.',
      '6/10, nothing special',
    ];
    let resp = phrases[Math.floor(Math.random() * phrases.length)];
    if (message.author.id === '125025069402554368') {
      resp = '10/10, i want it to rub on my soft furry programming!';
    }
    if (message.author.id === '153364394443669507') {
      resp = 'holy shit, WTF is wrong with that thing, go see a doctor... for real.';
    }
    await message.channel.send(resp, {
      split: true,
    });
  }
}
