import { Message } from 'discord.js';
import SassybotCommand from './SassybotCommand';
import fetch from 'node-fetch';

export default class InspireCommand extends SassybotCommand {
  public readonly commands = ['inspire'];

  public getHelpText(): string {
    return 'I give you an inspirational image';
  }

  protected async listener({ message }: { message: Message }): Promise<void> {
    const response = await fetch('https://inspirobot.me/api?generate=true', {
      method: 'GET',
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10.15; rv:98.0) Gecko/20100101 Firefox/98.0',
        Accept: '*/*',
        'Accept-Language': 'en-US,en;q=0.5',
        'Accept-Encoding': 'gzip, deflate, br',
        'X-Requested-With': 'XMLHttpRequest',
        Connection: 'keep-alive',
        Referer: 'https://inspirobot.me/',
        'Sec-Fetch-Dest': 'empty',
        'Sec-Fetch-Mode': 'cors',
        'Sec-Fetch-Site': 'same-origin',
        Pragma: 'no-cache',
        'Cache-Control': 'no-cache',
      },
    });

    const imageLink = response.text();

    await message.channel.send({ content: imageLink });
  }
}
