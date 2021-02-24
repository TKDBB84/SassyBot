import { Message, MessageCollector } from 'discord.js';
import { ISassybotCommandParams } from '../../Sassybot';
import SassybotCommand from './SassybotCommand';
import { PodcastRoleId, GuildIds } from '../../consts';

export default class EchoCommand extends SassybotCommand {
  public readonly commands = ['podcast', 'podcasts'];

  public getHelpText(): string {
    return "usage: `!{sassybot|sb} podcast` -- toggle whether you're interested in participating in the podcast";
  }

  protected async listener({ message, params }: { message: Message; params: ISassybotCommandParams }): Promise<void> {
    const messageChannel = message.channel;
    if (
      !message.guild ||
      !message.member ||
      message.guild.id !== GuildIds.COT_GUILD_ID ||
      !this.sb.isTextChannel(messageChannel)
    ) {
      return;
    }
    const member = message.member;
    if (member.roles.cache.has(PodcastRoleId)) {
      const filter = (filterMessage: Message) => filterMessage.author.id === message.author.id;
      const messageCollector = new MessageCollector(messageChannel, filter, { max: 1, time: 60000 });
      await message.reply('Are you sure you want to leave?');
      messageCollector.on('collect', async (collectedMessage: Message) => {
        const text = collectedMessage.cleanContent.toLowerCase();
        if (['yes', 'y', 'yup', 'sure', 'ye', 'yeah', 'si', 'yah', 'yea'].includes(text)) {
          await member.roles.remove(PodcastRoleId, 'requested to leave forward & back');
          await message.reply('Done! You have been removed.');
        } else {
          await message.reply('Not confirmed. No Change Made.');
        }
      });
    } else {
      await member.roles.add(PodcastRoleId, 'request to join forward & back');
      await message.reply('Done! You should now have the new role.');
    }
  }
}
