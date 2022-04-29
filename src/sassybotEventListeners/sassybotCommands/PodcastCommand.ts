import { Message, MessageCollector } from 'discord.js';
import SassybotCommand from './SassybotCommand';
import { PodcastRoleId, GuildIds, affirmativeResponses } from '../../consts';

export default class PodcastCommand extends SassybotCommand {
  public readonly commands = ['podcast', 'podcasts'];

  public getHelpText(): string {
    return "usage: `!{sassybot|sb} podcast` -- toggle whether you're interested in participating in the podcast";
  }

  protected async listener({ message }: { message: Message }): Promise<void> {
    const messageChannel = message.channel;
    if (
      !message.guild ||
      !message.member ||
      message.guild.id !== GuildIds.COT_GUILD_ID ||
      !this.sb.isTextChannel(messageChannel)
    ) {
      return;
    }
    const author = message.author.id;
    const member = await this.sb.getMember(GuildIds.COT_GUILD_ID, author);
    if (!member) {
      return;
    }
    if (member.roles.cache.has(PodcastRoleId)) {
      const filter = (filterMessage: Message) => filterMessage.author.id === message.author.id;
      const messageCollector = new MessageCollector(messageChannel, { filter, max: 1, time: 60000 });
      await message.reply('Are you sure you want to leave?');
      messageCollector.on('collect', (collectedMessage: Message) => {
        const text = collectedMessage.cleanContent.toLowerCase();
        if (affirmativeResponses.includes(text)) {
          void member.roles
            .remove(PodcastRoleId, 'requested to leave forward & back')
            .then(() => message.reply('Done! You have been removed.'));
        } else {
          void message.reply('Not confirmed. No Change Made.');
        }
      });
    } else {
      await member.roles.add(PodcastRoleId, 'request to join forward & back');
      await message.reply('Done! You should now have the new role.');
    }
  }
}
