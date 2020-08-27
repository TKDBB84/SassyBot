import * as moment from 'moment';
import { In, LessThan } from 'typeorm';
import { CoTAPIId, CoTOfficerChannelId, CotRanks, GuildIds } from './consts';
import COTMember from './entity/COTMember';
import Event from './entity/Event';
import FFXIVChar from './entity/FFXIVChar';
import PromotionRequest from './entity/PromotionRequest';
import { Sassybot } from './Sassybot';
import { Role } from 'discord.js';
// @ts-ignore
import * as XIVAPI from 'xivapi-js';

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
            return {
              ...member,
              Rank: 'OFFICER',
            };
          case 'VETERAN':
          case 'STEWARDS':
            return {
              ...member,
              Rank: 'VETERAN',
            };
          case 'DIGNITARY':
          case 'MEMBER':
            return {
              ...member,
              Rank: 'MEMBER',
            };
          default:
            return {
              ...member,
              Rank: 'RECRUIT',
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

  // return new Promise((resolve) => {
  //   const client = http2.connect('https://xivapi.com:443');
  //   client.on('error', (e) => sb.logger.error('error in getLatestMemberList', e));
  //   const req = client.request({
  //     ':path': `/freecompany/${CoTAPIId}?private_key=${process.env.XIV_API_TOKEN}&data=FCM`,
  //   });
  //   req.setEncoding('utf8');
  //   let responseBody = '';
  //   req.on('data', (chunk) => {
  //     responseBody += chunk;
  //   });
  //   req.on('end', () => {
  //     let finalResult: IFreeCompanyMember[] = [];
  //     try {
  //       const parsedBody = JSON.parse(responseBody);
  //       if (parsedBody.hasOwnProperty('FreeCompanyMembers')) {
  //         finalResult = parsedBody.FreeCompanyMembers;
  //       }
  //     } catch (err) {
  //       sb.logger.error('Error From XIVAPI', { err });
  //       finalResult = [];
  //     }
  //     client.close(() => {
  //       resolve(
  //         finalResult.map((r) => {
  //           const Rank = r.Rank.toUpperCase().trim();
  //           if (['FOUNDER', 'FCM', 'NOTMIA', 'OFFICER'].includes(Rank)) {
  //             return {
  //               ...r,
  //               Rank: 'OFFICER',
  //             };
  //           }
  //           if (Rank === 'DIGNITARY') {
  //             return {
  //               ...r,
  //               Rank: 'MEMBER',
  //             };
  //           }
  //           if (Rank === 'STEWARDS') {
  //             return {
  //               ...r,
  //               Rank: 'VETERAN',
  //             };
  //           }
  //           if (Rank === 'MEMBER' || Rank === 'VETERAN') {
  //             return {
  //               ...r,
  //               Rank,
  //             };
  //           }
  //           return {
  //             ...r,
  //             Rank: 'RECRUIT',
  //           };
  //         }),
  //       );
  //     });
  //   });
  //   req.end();
  // });
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

    const charUpdates = {
      apiId: +lodestoneMember.ID,
      firstSeenApi: pullTime,
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
      if (characterData.firstSeenApi) {
        delete charUpdates.firstSeenApi;
      }
      await characterRepo.update(characterData.id, charUpdates);
    } else {
      character = characterRepo.create(charUpdates);
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
        discordAdd = MEMBER;
        discordRemove = [VETERAN, MEMBER, GUEST].filter((role): role is Role => !!role);
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
      const discordMember = await sb.getMember(GuildIds.COT_GUILD_ID, sbUser.discordUserId);
      const isLocalOfficer = targetRank === CotRanks.OFFICER || cotMember.rank >= CotRanks.OFFICER;
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
        sb.logger.warn("couldn't report to officers channel", { error, CoTOfficerChannelId });
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

const cleanUpOldMembers = async (sb: Sassybot) => {
  const nowMoment = moment();
  const FIFTEEN_DAYS_AGO = nowMoment.subtract(15, 'days').toDate();
  const NINETY_DAYS_AGO = nowMoment.subtract(90, 'days').toDate();
  const TWO_HUNDRED_SEVENTY_FIVE_DAYS_AGO = nowMoment.subtract(275, 'days').toDate();

  const charRepo = sb.dbConnection.getRepository(FFXIVChar);
  const memberRepo = sb.dbConnection.getRepository(COTMember);

  const relevantMembers = await memberRepo.find({
    where: { rank: In<CotRanks>([CotRanks.VETERAN, CotRanks.MEMBER, CotRanks.RECRUIT]) },
  });

  const lostMembers = relevantMembers.filter((member) => {
    switch (member.rank) {
      case CotRanks.VETERAN:
        return member.character.lastSeenApi < TWO_HUNDRED_SEVENTY_FIVE_DAYS_AGO;
      case CotRanks.MEMBER:
        return member.character.lastSeenApi < NINETY_DAYS_AGO;
      case CotRanks.RECRUIT:
        return member.character.lastSeenApi < FIFTEEN_DAYS_AGO;
      default:
        return false;
    }
  });

  for (let i = 0, iMax = lostMembers.length; i < iMax; i++) {
    const member = lostMembers[i];
    const discordId = member.character.user.discordUserId;
    if (discordId) {
      const discordMember = await sb.getMember(GuildIds.COT_GUILD_ID, discordId);

      const promises: Promise<any>[] = [];
      if (discordMember) {
        promises.push(
          discordMember.roles.remove([CotRanks.VETERAN, CotRanks.MEMBER, CotRanks.RECRUIT], 'No longer seen in FC'),
        );
        promises.push(discordMember.roles.add(CotRanks.GUEST, 'No longer seen in FC'));
      }
      promises.push(memberRepo.query(`DELETE FROM cot_member WHERE id = ${member.id}`));
      promises.push(
        charRepo.query(
          `UPDATE ffxiv_char SET firstSeenApi = NULL, lastSeenApi = NULL WHERE id = ${member.character.id}`,
        ),
      );
      await Promise.all(promises);
    }
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
  // {
  //   job: annoyRyk,
  //   schedule: every15Min,
  // },
];

export default jobs;
