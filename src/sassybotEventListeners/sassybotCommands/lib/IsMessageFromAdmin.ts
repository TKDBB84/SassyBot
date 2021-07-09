import { CotRanks, GuildIds, UserIds } from '../../../consts';
import { Message, Role } from 'discord.js';

const isMessageFromAdmin = (message: Message, officer: Role | null): boolean => {
  let isDiscordOfficer = [UserIds.SASNER.toString(), UserIds.CAIT.toString()].includes(message.author.id.toString());
  if (!isDiscordOfficer && message.guild?.id === GuildIds.COT_GUILD_ID && message.member) {
    if (officer) {
      isDiscordOfficer = CotRanks.OFFICER && message.member?.roles.highest.comparePositionTo(officer) >= 0;
    }
  }
  return isDiscordOfficer;
};

export default isMessageFromAdmin;
