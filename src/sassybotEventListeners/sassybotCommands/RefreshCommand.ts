import { Message } from 'discord.js';
import SassybotCommand from './SassybotCommand';
import { UserIds } from '../../consts';
import jobs from '../../cronJobs';
import FFXIVChar from '../../entity/FFXIVChar';
import { IsNull, Not } from 'typeorm';
import moment from 'moment';
import SbUser from '../../entity/SbUser';
import { performance } from 'perf_hooks';
import { ISassybotCommandParams } from '../../Sassybot';

export default class RefreshCommand extends SassybotCommand {
  public readonly commands = ['refresh', 'refreshed', 'refreshs', 'refreshes'];

  public getHelpText(): string {
    return 'usage: `!{sassybot|sb} refresh` -- Shows the last time I was able to pull lodestone data about FC members';
  }

  protected async listener({ message, params }: { message: Message; params: ISassybotCommandParams }): Promise<void> {
    if (message.author.id === UserIds.SASNER && params.args.trim().toLowerCase() === 'now') {
      await message.channel.send({ content: `Starting Admin Initiated Data Sync` });
      const start = performance.now();
      await jobs[0].job(this.sb);
      await message.channel.send(`Refresh Completed In ${(performance.now() - start).toFixed(3)}ms`);
    }
    const thisUser = await this.sb.dbConnection
      .getRepository<SbUser>(SbUser)
      .findOne({ where: { discordUserId: message.author.id } });
    const lastRefreshedCharacter = await this.sb.dbConnection
      .getRepository<FFXIVChar>(FFXIVChar)
      .findOne({ where: { lastSeenApi: Not(IsNull()) }, order: { lastSeenApi: 'DESC' } });
    if (lastRefreshedCharacter) {
      const lastRefresh = moment(lastRefreshedCharacter.lastSeenApi);
      const lastRefreshString = lastRefresh
        .tz(thisUser && thisUser.timezone && moment.tz.zone(thisUser.timezone) ? thisUser.timezone : 'UTC')
        .format('LT');
      void message.reply({ content: `Fresh FC Member Data Was Pulled At: ${lastRefreshString}` });
    }
  }
}
