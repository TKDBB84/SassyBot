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
      "fuck man, what is that thing, I don't think I can even rate that: -1 out of 10",
      "7/10, I'd let that thing my code",
      '6/10, just fine, i suppose',
      '3/10, just barely passable',
      'I plead the 5th',
      '1/10, no... just no',
      "1/10, have you ever seen a cock before? Because that's a not a cock",
      '4/10, not even big enough to be a pain in the ass',
    ];
    let content = phrases[Math.floor(Math.random() * phrases.length)];
    if (message.author.id === '125025069402554368') {
      content = 'shit i forgot my costume... i can make it up in other ways i swear!';
    }
    if (message.author.id === '153364394443669507') {
      content = 'holy shit, WTF is wrong with that thing, go see a doctor... for real.';
    }
    await message.channel.send({ content, reply: { messageReference: message } });
  }
}
