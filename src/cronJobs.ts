import * as moment from 'moment';
import { In, LessThan } from 'typeorm';
import { CoTAPIId, CoTOfficerChannelId, CotRanks, GuildIds } from './consts';
import COTMember from './entity/COTMember';
import Event from './entity/Event';
import FFXIVChar from './entity/FFXIVChar';
import PromotionRequest from './entity/PromotionRequest';
import { Sassybot } from './Sassybot';
import { GuildMember, Role } from 'discord.js';
// @ts-ignore
import * as XIVAPI from 'xivapi-js';
import AbsentRequest from './entity/AbsentRequest';

export interface IScheduledJob {
  job: (sb: Sassybot) => Promise<void>;
  schedule: string;
}

interface IFreeCompanyMember {
  Avatar: string;
  FeastMatches: number;
  ID: number;
  Name: string;
  Rank: 'MEMBER' | 'RECRUIT' | 'VETERAN' | 'OFFICER';
  RankIcon: string;
  Server: string;
  exactRecruit: boolean;
}
const getLatestMemberList = async (sb: Sassybot): Promise<IFreeCompanyMember[]> => {
  const xiv = new XIVAPI({ private_key: process.env.XIV_API_TOKEN, language: 'en' });
  try {
    const memberList = await xiv.freecompany.get(CoTAPIId, { data: 'FCM' });
    if (memberList && memberList.FreeCompanyMembers) {
      return memberList.FreeCompanyMembers.map((member: IFreeCompanyMember) => {
        const Rank = member.Rank.toUpperCase().trim();
        switch (Rank) {
          case 'FOUNDER':
          case 'FCM':
          case 'NOTMIA':
          case 'OFFICER':
          case 'GLUE EATER':
          case 'AN ACADEMIC':
            return {
              ...member,
              Rank: 'OFFICER',
              exactRecruit: false,
            };
          case 'VETERAN':
          case 'STEWARDS':
          case 'MY SIMPS <3':
            return {
              ...member,
              Rank: 'VETERAN',
              exactRecruit: false,
            };
          case 'DIGNITARY':
          case 'MEMBER':
            return {
              ...member,
              Rank: 'MEMBER',
              exactRecruit: false,
            };
          case 'RECRUIT':
            return {
              ...member,
              Rank: 'RECRUIT',
              exactRecruit: true,
            };
          default:
            return {
              ...member,
              Rank: 'RECRUIT',
              exactRecruit: false,
            };
        }
      });
    } else {
      sb.logger.error('Could not fetch member list');
    }
  } catch (err) {
    sb.logger.error('Could not fetch member list', err);
  }
  return [];
};

const updateCotMembersFromLodeStone = async (sb: Sassybot) => {
  const pullTime = new Date();
  const lodestoneMembers = await getLatestMemberList(sb);
  const cotMemberRepo = sb.dbConnection.getRepository(COTMember);
  const characterRepo = sb.dbConnection.getRepository(FFXIVChar);

  const [OFFICER, VETERAN, MEMBER, RECRUIT, GUEST] = await Promise.all([
    sb.getRole(GuildIds.COT_GUILD_ID, CotRanks.OFFICER),
    sb.getRole(GuildIds.COT_GUILD_ID, CotRanks.VETERAN),
    sb.getRole(GuildIds.COT_GUILD_ID, CotRanks.MEMBER),
    sb.getRole(GuildIds.COT_GUILD_ID, CotRanks.RECRUIT),
    sb.getRole(GuildIds.COT_GUILD_ID, CotRanks.GUEST),
  ]);

  const membersByApiId = lodestoneMembers.reduce((carry: { [key: string]: IFreeCompanyMember }, member) => {
    if (!carry[member.ID]) {
      carry[member.ID] = member;
    } else {
      sb.logger.info('skipping: ', { duplicate: member });
    }
    return carry;
  }, {});

  const deDupedMembers = Object.values(membersByApiId);

  for (let i = 0, iMax = deDupedMembers.length; i < iMax; i++) {
    const lodestoneMember = deDupedMembers[i];
    let cotMember;
    let character;

    const charUpdates: { apiId: number; lastSeenApi: Date; name: string } = {
      apiId: +lodestoneMember.ID,
      lastSeenApi: pullTime,
      name: lodestoneMember.Name.trim(),
    };

    const characterData = await characterRepo
      .createQueryBuilder()
      .where({ apiId: +lodestoneMember.ID })
      .orWhere(`LOWER(TRIM(name)) = LOWER(:name)`, { name: lodestoneMember.Name.trim().toLowerCase() })
      .getOne();
    if (characterData && characterData.id) {
      character = await characterRepo.findOneOrFail(characterData.id);
      await characterRepo.update(characterData.id, {
        ...charUpdates,
        firstSeenApi: characterData.firstSeenApi || pullTime
      });
    } else {
      character = characterRepo.create({
        ...charUpdates,
        firstSeenApi: pullTime,
      });
      character = await characterRepo.save(character, { reload: true });
    }

    cotMember = await cotMemberRepo.findOne({ where: { character: { id: character.id } } });

    let targetRank;
    let discordRemove: Role[];
    let discordAdd: Role | null | undefined;
    switch (CotRanks[lodestoneMember.Rank]) {
      case CotRanks.OFFICER:
        targetRank = CotRanks.OFFICER;
        // don't touch officers
        discordRemove = [];
        break;
      case CotRanks.VETERAN:
        targetRank = CotRanks.VETERAN;
        discordAdd = VETERAN;
        discordRemove = [MEMBER, RECRUIT, GUEST].filter((role): role is Role => !!role);
        break;
      case CotRanks.MEMBER:
        targetRank = CotRanks.MEMBER;
        discordAdd = MEMBER;
        discordRemove = [VETERAN, RECRUIT, GUEST].filter((role): role is Role => !!role);
        break;
      default:
      case CotRanks.RECRUIT:
        targetRank = CotRanks.RECRUIT;
        if (lodestoneMember.exactRecruit) {
          discordAdd = RECRUIT;
          discordRemove = [VETERAN, MEMBER, GUEST].filter((role): role is Role => !!role);
        } else {
          discordRemove = [];
        }
        break;
    }

    if (!cotMember) {
      const newMember = cotMemberRepo.create();
      newMember.rank = targetRank;
      newMember.character = character;
      cotMember = await cotMemberRepo.save(newMember, { reload: true });
    } else {
      if (targetRank !== cotMember.rank) {
        await cotMemberRepo.update(cotMember.id, { rank: targetRank });
      }
    }

    const sbUser = character.user;
    if (sbUser && sbUser.discordUserId) {
      const isLocalOfficer = targetRank === CotRanks.OFFICER || cotMember.rank >= CotRanks.OFFICER;
      try {
        const discordMember = await sb.getMember(GuildIds.COT_GUILD_ID, sbUser.discordUserId);
        if (discordMember) {
          const isDiscordOfficer = OFFICER && discordMember.roles.highest.comparePositionTo(OFFICER) >= 0;
          const possiblyOfficer = isLocalOfficer || isDiscordOfficer;
          if (discordAdd && !possiblyOfficer) {
            await discordMember.roles.add(discordAdd, 'updated in lodestone');
          }
          if (discordRemove.length && !possiblyOfficer) {
            await discordMember.roles.remove(discordRemove, 'updated in lodestone');
          }
        }
      } catch (e) {
        // user no longer in discord
        if (e.message === 'Unknown Member' && e.httpStatus === 404 && character.id) {
          await characterRepo.query(`UPDATE ffxiv_char SET userDiscordUserId = NULL WHERE id = ${character.id}`);
        }
      }
    }
  }
};

const checkForReminders = async (sb: Sassybot) => {
  const TWENTY_DAYS_AGO = new Date();
  TWENTY_DAYS_AGO.setTime(new Date().getTime() - 480 * (60 * 60 * 1000));
  const oldPromotionCount = await sb.dbConnection
    .getRepository(PromotionRequest)
    .count({ where: { requested: LessThan<Date>(TWENTY_DAYS_AGO) } });
  sb.logger.info(`${oldPromotionCount} old promotions found`);
  if (oldPromotionCount >= 2) {
    const officerChat = await sb.getTextChannel(CoTOfficerChannelId);
    if (officerChat) {
      const officeRole = await sb.getRole(GuildIds.COT_GUILD_ID, CotRanks.OFFICER);
      try {
        await officerChat.send(
          `Hi ${
            officeRole ? officeRole : 'Officers'
          }, I'm just here to let you know that there are currently ${oldPromotionCount} promotion requests that are more than 20 days old.`,
        );
      } catch (error) {
        sb.logger.error("couldn't report to officers channel", { error, CoTOfficerChannelId });
      }
    }
  }
};

const deletePastEvents = async (sb: Sassybot) => {
  const eventRepo = sb.dbConnection.getRepository(Event);
  const YESTERDAY = new Date();
  YESTERDAY.setTime(new Date().getTime() - 24 * (60 * 60 * 1000));
  await eventRepo.delete({ eventTime: LessThan<Date>(YESTERDAY) });
};

const deletePastAbsences = async (sb: Sassybot) => {
  const absentRepo = sb.dbConnection.getRepository(AbsentRequest);
  const YESTERDAY = new Date();
  YESTERDAY.setTime(new Date().getTime() - 24 * (60 * 60 * 1000));
  await absentRepo.delete({endDate: LessThan<Date>(YESTERDAY)})
}

const cleanUpOldMembers = async (sb: Sassybot) => {
  const nowMoment = moment();
  // const FIFTEEN_DAYS_AGO = nowMoment.subtract(15, 'days').toDate();
  // const NINETY_DAYS_AGO = nowMoment.subtract(90, 'days').toDate();
  const TWO_HUNDRED_SEVENTY_FIVE_DAYS_AGO = nowMoment.subtract(275, 'days').toDate();

  const charRepo = sb.dbConnection.getRepository(FFXIVChar);
  const memberRepo = sb.dbConnection.getRepository(COTMember);

  const relevantMembers = await memberRepo.find({
    where: { rank: In<CotRanks>([CotRanks.VETERAN, CotRanks.MEMBER, CotRanks.RECRUIT]) },
  });

  const lostMembers = relevantMembers.filter(
    (member) => !!member.character.lastSeenApi && member.character.lastSeenApi < TWO_HUNDRED_SEVENTY_FIVE_DAYS_AGO,
  );

  for (let i = 0, iMax = lostMembers.length; i < iMax; i++) {
    const member = lostMembers[i];
    const discordId = member.character.user?.discordUserId;
    const promises: Promise<any>[] = [];
    if (discordId) {
      const discordMember: GuildMember | undefined | false = await sb
        .getMember(GuildIds.COT_GUILD_ID, discordId)
        .catch(() => false);

      if (discordMember) {
        promises.push(
          discordMember.roles.remove([CotRanks.VETERAN, CotRanks.MEMBER, CotRanks.RECRUIT], 'No longer seen in FC'),
        );
        promises.push(discordMember.roles.add(CotRanks.GUEST, 'No longer seen in FC'));
      }
    }
    promises.push(memberRepo.query(`DELETE FROM cot_member WHERE id = ${member.id}`));
    promises.push(
      charRepo.query(`UPDATE ffxiv_char SET firstSeenApi = NULL, lastSeenApi = NULL WHERE id = ${member.character.id}`),
    );
    await Promise.all(promises);
  }
};

// const delay = (ms: number) => new Promise((res) => setTimeout(res, ms));

// const annoyRyk = async (sb: Sassybot) => {
//   const guild = await sb.getGuild(GuildIds.GAMEZZZ_GUILD_ID);
//   const SassyBot = await sb.getMember(GuildIds.GAMEZZZ_GUILD_ID, UserIds.SASSYBOT);
//   if (guild && SassyBot) {
//     const textChannels = guild.channels.cache.array();
//     const mixedChannels: (null | TextChannel)[] = await Promise.all(
//       textChannels.map(async (channel) => {
//         if (sb.isTextChannel(channel)) {
//           const permissions = await channel.permissionsFor(SassyBot);
//           if (permissions && permissions.has('SEND_MESSAGES')) {
//             return channel;
//           }
//         }
//         return null;
//       }),
//     );
//     const allowableChannels = mixedChannels.filter(sb.isTextChannel);
//     const randomTextChannel = allowableChannels[Math.floor(Math.random() * allowableChannels.length)];
//     await randomTextChannel.startTyping();
//     sb.logger.info('start typing', { name: randomTextChannel.name });
//     await delay(30000);
//     sb.logger.info('stop typing', { name: randomTextChannel.name });
//     randomTextChannel.stopTyping(true);
//   }
// };

const twiceADay = '0 15 8,20 * * *';
const daily = '0 0 20 * * *';
const afterTwiceADay = '0 30 8,20 * * *';
// const every15Min = '0 0,15,30,45 * * * *';

const jobs: IScheduledJob[] = [
  {
    job: updateCotMembersFromLodeStone,
    schedule: twiceADay,
  },
  {
    job: checkForReminders,
    schedule: daily,
  },
  {
    job: deletePastEvents,
    schedule: twiceADay,
  },
  {
    job: cleanUpOldMembers,
    schedule: afterTwiceADay,
  },
  {
    job: deletePastAbsences,
    schedule: twiceADay,
  }
  // {
  //   job: annoyRyk,
  //   schedule: every15Min,
  // },
];

export default jobs;
