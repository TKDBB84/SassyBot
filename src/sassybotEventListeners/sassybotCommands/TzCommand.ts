import { Message } from 'discord.js';
import * as moment from 'moment-timezone';
import SbUser from '../../entity/SbUser';
import { ISassybotCommandParams } from '../../Sassybot';
import SassybotCommand from './SassybotCommand';

export default class TzCommand extends SassybotCommand {
  private static wikiLink = 'https://en.wikipedia.org/wiki/List_of_tz_database_time_zones';
  public readonly command = 'tz';

  public getHelpText(): string {
    return (
      'usage: `!{sassybot|sb} tz {iana timezone name}` --- a complete list of timezones can be found here\n' +
      TzCommand.wikiLink
    );
  }
  protected async listener({ message, params }: { message: Message; params: ISassybotCommandParams }): Promise<void> {
    const userRepository = this.sb.dbConnection.getRepository(SbUser);
    let currentUser = await userRepository.findOne(message.author.id);
    if (!currentUser) {
      currentUser = new SbUser();
      currentUser.discordUserId = message.author.id;
    }

    if (params.args.trim()) {
      // return current timezone
      const newTz = params.args.trim().toLowerCase();
      if (!moment.tz.zone(newTz)) {
        await message.channel.send(
          "Sorry, that doesn't appear to be a timezone I know, there's a full list of valid timezones here:\n" +
            TzCommand.wikiLink,
        );
        return;
      }
      currentUser.timezone = newTz;
      currentUser = await userRepository.save(currentUser, { reload: true });
    }
    await message.channel.send(
      `I have your timezone as: \`${currentUser.timezone}\` your local time should be: ${moment()
        .tz(currentUser.timezone)
        .format('LT')}`,
    );
  }
}
