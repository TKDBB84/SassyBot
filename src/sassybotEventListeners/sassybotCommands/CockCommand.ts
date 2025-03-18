import { Message } from 'discord.js';
import SassybotCommand from './SassybotCommand';

export default class CockCommand extends SassybotCommand {
  public readonly commands = ['cock'];

  public getHelpText(): string {
    return 'yeah, you do really need help.';
  }

  protected async listener({ message }: { message: Message }): Promise<void> {
    if (!message.channel.isSendable()) {
      return;
    }

    const phrases = [
      '8/10, a little firm but gets the job done',
      '10/10, nice cock bro',
      '10/10, I ❤ three inchers',
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
      "7/10, I'd let that thing in my code",
      '6/10, just fine, i suppose',
      '3/10, just barely passable',
      'I plead the 5th',
      '1/10, no... just no',
      "1/10, have you ever seen a cock before? Because that's not a cock",
      '2/10, not even big enough to be a pain in the ass',
      '...is it an innie?',
      "**DAMN GIRL**, That's a huge cock you have! I give it a confused 9/10",
      '10/10, Zachary Scuderi would be proud of that tuck',
      "6/10, pretty much the same as every other one i've seen",
      '10/10, Meaty AF',
      "8/10, sure it's big, but points off for that weird shape",
      'well... hopefully you have a long tongue.  2/10',
    ];

    if (message.author.id === '125025069402554368') {
      phrases.push(
        '10/10, i want it to rub on my soft furry programming',
        'mmmm... yeah put that on my fur',
        "it's so soft and fluffy....",
      );
    }
    const content = phrases[Math.floor(Math.random() * phrases.length)];
    await message.channel.send({ content, reply: { messageReference: message } });
  }
}
