import { Message } from 'discord.js';
import { UserIds } from '../../consts';
import SpamChannel from '../../entity/SpamChannel';
import SassybotCommand from './SassybotCommand';

export default class SpamCommand extends SassybotCommand {
  public readonly commands = ['spam'];

  public getHelpText(): string {
    return 'usage: `!{sassybot|sb}` spam -- this cause me to spam users enter, leaving, or changing voice rooms into the channel this commands was specified -- only available to admins';
  }

  protected async listener({ message }: { message: Message }): Promise<void> {
    if (!message.guild) {
      return;
    }
    const authorId = message.author.id;
    if (message.member?.hasPermission('ADMINISTRATOR') || authorId === UserIds.SASNER) {
      const spamChannelRepo = this.sb.dbConnection.getRepository(SpamChannel);
      let spamChannel = await spamChannelRepo.findOne({ guildId: message.guild.id });
      if (!spamChannel) {
        spamChannel = new SpamChannel();
        spamChannel.guildId = message.guild.id;
      }
      spamChannel.channelId = message.channel.id;
      await spamChannelRepo.save(spamChannel);
      await message.channel.send("Ok, I'll spam this channel");
    } else {
      await message.channel.send('This functionality is limited to Server Admins');
    }
  }
}
