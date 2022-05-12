import { Message } from 'discord.js';
import { ISassybotCommandParams } from '../../Sassybot';
import SassybotCommand from './SassybotCommand';
import { getNumberOFDays, isMessageFromAdmin } from './lib';
import FFXIVChar from '../../entity/FFXIVChar';
import moment from 'moment';
import { CotRanks, GuildIds } from '../../consts';

export default class SetDaysCommand extends SassybotCommand {
  public readonly commands = ['setDays', 'setDay'];

  public getHelpText(): string {
    return 'usage: `!{sassybot|sb} setDays [number of days] [Cot Member Name]` -- I update the listed member to have been in CoT for that many days.';
  }

  protected async listener({ message, params }: { message: Message; params: ISassybotCommandParams }): Promise<void> {
    const officer = await this.sb.getRole(GuildIds.COT_GUILD_ID, CotRanks.OFFICER);
    if (!isMessageFromAdmin(message, officer)) {
      await message.channel.send('This Command Is Only Available to Admins');
      return;
    }

    const results = /^(\d+)\s+(.*)$/.exec(params.args.trim());
    if (!results || !results[1] || !results[2]) {
      await message.channel.send(`Invalid Format\n${this.getHelpText()}`);
      return;
    }
    const numDays = parseInt(results[1], 10);
    const memberName = results[2].trim();

    if (numDays < 0) {
      await message.channel.send('I cannot set number of days below 0');
      return;
    }
    const charRepo = this.sb.dbConnection.getRepository(FFXIVChar);
    const character = await charRepo
      .createQueryBuilder()
      .where(`LOWER(name) = LOWER(:name)`, { name: memberName.toLowerCase() })
      .getOne();

    if (!character || !character.firstSeenApi || moment(character.firstSeenApi).isBefore('1900-01-01 00:00:00')) {
      await message.channel.send('This Character Does Not Seem To Be A CoT Member.');
      return;
    }

    const newStartDate = moment().subtract(numDays, 'days');
    await charRepo.update(character.id, { firstSeenApi: newStartDate.toDate() });

    const refreshedChar = await charRepo.findOne({ where: { id: character.id } });
    if (refreshedChar) {
      await message.channel.send(
        `${refreshedChar.name} has been in the FC for approximately ${getNumberOFDays(
          refreshedChar.firstSeenApi,
        )} days.`,
      );
    }
  }
}
