import { Message } from 'discord.js';
import { ISassybotCommandParams } from '../../Sassybot';
import SassybotCommand from './SassybotCommand';
import * as JokeAPI from 'sv443-joke-api';

export default class PunCommand extends SassybotCommand {
  public readonly commands = ['pun', 'puns', 'joke', 'jokes'];

  public getHelpText(): string {
    return 'usage: `!{sassybot|sb} pun` -- I send a stupid pun to the channel';
  }

  protected async listener({ message, params }: { message: Message; params: ISassybotCommandParams }): Promise<void> {
    const jokeRes = await JokeAPI.getJokes({categories: ["Pun"], jokeType: 'twopart'})
    const data = jokeRes.json()
    const text = `${data.setup}\n\n||${data.delivery}||`
    await message.channel.send(text, {
      split: false,
    });
  }
}
