import { CotRanks, GuildIds, UserIds } from '../../../consts';
import { ChatInputCommandInteraction, GuildMember, Message, Role } from 'discord.js';

const isMessageFromAdmin = (
  messageOrInteraction: Message | ChatInputCommandInteraction,
  officer: Role | null,
): boolean => {
  const userId = 'author' in messageOrInteraction ? messageOrInteraction.author.id : messageOrInteraction.user.id;
  let isDiscordOfficer = [UserIds.SASNER.toString(), UserIds.CAIT.toString()].includes(userId.toString());
  if (
    !isDiscordOfficer &&
    messageOrInteraction.guild?.id === GuildIds.COT_GUILD_ID &&
    messageOrInteraction.member instanceof GuildMember
  ) {
    if (officer) {
      isDiscordOfficer =
        Boolean(CotRanks.OFFICER) && messageOrInteraction.member.roles.highest.comparePositionTo(officer) >= 0;
    }
  }
  return isDiscordOfficer;
};

export default isMessageFromAdmin;
