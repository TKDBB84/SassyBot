import { Message } from 'discord.js';
import { ISassybotCommandParams } from '../../Sassybot';
import SassybotCommand from './SassybotCommand';
import fetch from 'node-fetch';

export default class PunCommand extends SassybotCommand {
  public readonly commands = ['pun', 'puns', 'joke', 'jokes'];

  public getHelpText(): string {
    return 'usage: `!{sassybot|sb} pun` -- I send a stupid pun to the channel';
  }

  protected async listener({ message, params }: { message: Message; params: ISassybotCommandParams }): Promise<void> {
    const jokeRes = await fetch('https://v2.jokeapi.dev/joke/Pun?type=twopart');
    const data: { setup: string; delivery: string } = await jokeRes.json();
    const text = `${data.setup}\n\n||${data.delivery}||`;
    await message.channel.send(text, {
      split: false,
    });
  }
}
