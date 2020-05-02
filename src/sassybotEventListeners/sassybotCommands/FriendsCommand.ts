import { Message } from 'discord.js';
import { ISassybotCommandParams } from '../../Sassybot';
import SassybotCommand from './SassybotCommand';

export default class FriendsCommand extends SassybotCommand {
  public readonly commands = ['friends'];

  public getHelpText(): string {
    return 'yeah, you do need help.';
  }

  protected async listener({ message, params }: { message: Message; params: ISassybotCommandParams }): Promise<void> {
    const phrases = ["I'm all of your friends are extermely caring, and are there for you whenever you need"];
    let resp = phrases[Math.floor(Math.random() * phrases.length)];
    if (message.author.id === '227941339411644417') {
      resp = "lul, you'd have to have friends in the first place";
    }
    await message.channel.send(resp, {
      split: true,
    });
  }
}
