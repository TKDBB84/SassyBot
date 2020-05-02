import { Message } from 'discord.js';
import { GuildIds } from '../consts';
import SassybotEventListener from './SassybotEventListener';

export default class BussyListener extends SassybotEventListener {
  public readonly event = 'messageReceived';

  public getEventListener() {
    return this.listener.bind(this);
  }

  protected async listener({ message }: { message: Message }): Promise<void> {
    if (message.author.id === '153364394443669507' && message.guild && message.guild.id === GuildIds.COT_GUILD_ID) {
      const bussy = await this.sb.getMember(GuildIds.COT_GUILD_ID, message.author.id);
      if (Math.random() <= 0.8) {
        await message.channel.send(`Hi, I\'d just like to remind everyone that ${bussy} wanted a bot to rate his cock`);
      }
    }
  }
}
