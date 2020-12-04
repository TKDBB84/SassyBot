import {Message, MessageCollector, Role} from 'discord.js';
import { ISassybotCommandParams } from '../../Sassybot';
import SassybotCommand from './SassybotCommand';
import {PodcastRoleId, GuildIds} from "../../consts";

export default class EchoCommand extends SassybotCommand {
  public readonly commands = ['podcast', 'podcasts'];

  public getHelpText(): string {
    return 'usage: `!{sassybot|sb} podcast` -- toggle whether you\'re interested in participating in the podcast';
  }

  protected async listener({ message, params }: { message: Message; params: ISassybotCommandParams }): Promise<void> {
    const messageChannel = message.channel
    if (!message.guild || !message.member) {
      return;
    }
    if (!this.sb.isTextChannel(messageChannel)) {
      return
    }
    const guildId = message.guild?.id
    if (!guildId || guildId !== GuildIds.COT_GUILD_ID) {
      return
    }
    const author = message.author.id
    const member = await this.sb.getMember(guildId, author)
    const podcastRole = await this.sb.getRole(guildId, PodcastRoleId)
    if (member && podcastRole) {
      if (member.roles.cache.has(PodcastRoleId)) {
        await message.reply('are you sure you want to leave?')
        const filter = (filterMessage: Message) => filterMessage.author.id === message.author.id;
        const messageCollector = new MessageCollector(messageChannel, filter, {max: 1, time: 60000});
        messageCollector.on('collect', async (collectedMessage: Message) => {
          const text = collectedMessage.cleanContent
          if (['yes', 'y', 'yup', 'sure', 'ye', 'yeah', 'si', 'yah', 'yea'].includes(text)) {
            await member.roles.remove(podcastRole, 'required to leave forward & back')
            await message.reply('done, the role should be gone')
          } else {
            await message.reply('not confirmed, canceling')
          }
        })
      } else {
        await member.roles.add(podcastRole, 'joined forward & back')
        await message.reply('done, you should now have the new role')
      }
    }
  }
}
