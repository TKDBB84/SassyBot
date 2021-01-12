import { Message } from 'discord.js';
import { ISassybotCommandParams } from '../../Sassybot';
import SassybotCommand from './SassybotCommand';
import * as JokeAPI from 'sv443-joke-api';
import { Response } from "node-fetch";

export default class PunCommand extends SassybotCommand {
  public readonly commands = ['pun', 'puns', 'joke', 'jokes'];

  public getHelpText(): string {
    return 'usage: `!{sassybot|sb} pun` -- I send a stupid pun to the channel';
  }

  protected async listener({ message, params }: { message: Message; params: ISassybotCommandParams }): Promise<void> {
    try {
      const jokeRes = await JokeAPI.getJokes({categories: ["Pun"], jokeType: 'twopart'})
      if (jokeRes instanceof Response) {
        const data: { setup: string, delivery: string } = await jokeRes.json()
        const text = `${data.setup}\n\n||${data.delivery}||`
        await message.channel.send(text, {
          split: false,
        });
      } else {
        this.sb.logger.warning('joke data', {jokeRes})
      }
    } catch (e) {
      this.sb.logger.warning('pun error', {e})
    }
  }
}
