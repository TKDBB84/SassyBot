// disabled for external fetch
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
    if (!message.channel.isSendable()) {
      return;
    }
    let url = 'https://v2.jokeapi.dev/joke';
    const command = params.command.toLowerCase();
    if (['pun', 'puns'].includes(command)) {
      url += '/Pun';
    } else {
      url += '/Any';
    }
    url += '?type=twopart';
    const jokeRes = await fetch(url);
    const data: { setup: string; delivery: string } = await jokeRes.json();
    const text = `${data.setup}\n\n||${data.delivery}||`;
    await message.channel.send(text);
  }
}
