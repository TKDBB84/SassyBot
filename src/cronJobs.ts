import moment from 'moment';
import { In, LessThan } from 'typeorm';
import { CoTAPIId, CoTOfficerChannelId, CotRanks, GuildIds } from './consts';
import COTMember from './entity/COTMember';
import Event from './entity/Event';
import FFXIVChar from './entity/FFXIVChar';
import PromotionRequest from './entity/PromotionRequest';
import { Sassybot } from './Sassybot';
import { GuildMember } from 'discord.js';
// @ts-ignore
import XIVApi from '@xivapi/js';
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
  const xiv = new XIVApi({ private_key: process.env.XIV_API_TOKEN, language: 'en' });
  try {
    const memberList = await xiv.freecompany.get(CoTAPIId, { data: 'FCM' });
    if (memberList && memberList.FreeCompanyMembers) {
      return memberList.FreeCompanyMembers.map((member: IFreeCompanyMember) => {
        const Rank = member.Rank.toUpperCase().trim();
        let exactRecruit = false;
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
              exactRecruit,
            };
          case 'VETERAN':
          case 'STEWARDS':
          case 'MY SIMPS <3':
            return {
              ...member,
              Rank: 'VETERAN',
              exactRecruit,
            };
          case 'DIGNITARY':
          case 'MEMBER':
            return {
              ...member,
              Rank: 'MEMBER',
              exactRecruit,
            };
          case 'RECRUIT':
            exactRecruit = true;
          default:
            return {
              ...member,
              Rank: 'RECRUIT',
              exactRecruit,
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

  const OFFICER = await sb.getRole(GuildIds.COT_GUILD_ID, CotRanks.OFFICER);
  if (!OFFICER) {
    sb.logger.error('could not fetch officer role', { OFFICER });
    throw new Error('Could not fetch officer role');
  }

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
        firstSeenApi: characterData.firstSeenApi || pullTime,
      });
    } else {
      character = characterRepo.create({
        ...charUpdates,
        firstSeenApi: pullTime,
      });
      character = await characterRepo.save(character, { reload: true });
    }

    cotMember = await cotMemberRepo.findOne({ where: { character: { id: character.id } } });

    const targetRank = CotRanks[lodestoneMember.Rank];
    let discordRemove: CotRanks[] = [CotRanks.VETERAN, CotRanks.MEMBER, CotRanks.RECRUIT, CotRanks.GUEST].filter(
      (rank) => rank !== targetRank,
    );
    let discordAdd: CotRanks | null = CotRanks[lodestoneMember.Rank];
    if (targetRank === CotRanks.OFFICER) {
      discordRemove = [];
    } else if (targetRank === CotRanks.RECRUIT) {
      if (lodestoneMember.exactRecruit) {
        discordAdd = CotRanks.RECRUIT;
      } else {
        discordAdd = null;
        discordRemove = [];
      }
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
          const isDiscordOfficer = CotRanks.OFFICER && discordMember.roles.highest.comparePositionTo(OFFICER) >= 0;
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
  const [oldPromotionCount, officeRole] = await Promise.all([
    sb.dbConnection.getRepository(PromotionRequest).count({ where: { requested: LessThan<Date>(TWENTY_DAYS_AGO) } }),
    sb.getRole(GuildIds.COT_GUILD_ID, CotRanks.OFFICER),
  ]);

  if (oldPromotionCount >= 1) {
    const officerChat = await sb.getTextChannel(CoTOfficerChannelId);
    if (!officerChat || !officeRole) {
      sb.logger.error("couldn't report to officers channel", { officeRole, officerChat });
      return;
    }

    const isAre = oldPromotionCount === 1 ? 'is' : 'are';
    const sOrEmpty = oldPromotionCount > 1 ? 's' : '';
    await officerChat.send(
      `Hi ${officeRole}, I'm just here to let you know that there ${isAre} currently ${oldPromotionCount} promotion request${sOrEmpty} that ${isAre} more than 20 days old.`,
    );
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
  await absentRepo.delete({ endDate: LessThan<Date>(YESTERDAY) });
};

const cleanUpOldMembers = async (sb: Sassybot) => {
  const nowMoment = moment();
  const FIFTEEN_DAYS_AGO = nowMoment.subtract(15, 'days').toDate();
  const THIRTY_ONE_DAYS_AGO = nowMoment.subtract(31, 'days').toDate();
  const NINETY_ONE_DAYS_AGO = nowMoment.subtract(91, 'days').toDate();
  // const ONE_HUNDRED_EIGHTY_ONE_DAYS_AGO = nowMoment.subtract(181, 'days').toDate();

  const charRepo = sb.dbConnection.getRepository(FFXIVChar);
  const memberRepo = sb.dbConnection.getRepository(COTMember);

  const relevantMembers = await memberRepo.find({
    where: { rank: In<CotRanks>([CotRanks.VETERAN, CotRanks.MEMBER, CotRanks.RECRUIT]) },
  });

  const allLostMembers = relevantMembers.filter((member) => {
    switch (member.rank) {
      case CotRanks.VETERAN:
        return !!member.character.lastSeenApi && member.character.lastSeenApi < NINETY_ONE_DAYS_AGO;
      case CotRanks.MEMBER:
        return !!member.character.lastSeenApi && member.character.lastSeenApi < THIRTY_ONE_DAYS_AGO;
      case CotRanks.RECRUIT:
      default:
        return !!member.character.lastSeenApi && member.character.lastSeenApi < FIFTEEN_DAYS_AGO;
    }
  });

  for (let i = 0, iMax = allLostMembers.length; i < iMax; i++) {
    const member = allLostMembers[i];
    const discordId = member.character.user?.discordUserId;
    const promises: Promise<any>[] = [];
    if (discordId) {
      const discordMember: GuildMember | undefined | false = await sb
        .getMember(GuildIds.COT_GUILD_ID, discordId)
        .catch(() => false);

      const promotionsRepo = sb.dbConnection.getRepository<PromotionRequest>(PromotionRequest);
      const promotions = await promotionsRepo.find({ where: { CotMember: member.id } });
      if (promotions) {
        promotions.forEach((promotion) => {
          promises.push(promotionsRepo.delete(promotion));
        });
      }

      if (discordMember) {
        promises.push(
          discordMember.roles.remove([CotRanks.VETERAN, CotRanks.MEMBER, CotRanks.RECRUIT], 'No longer seen in FC'),
        );
        promises.push(discordMember.roles.add(CotRanks.GUEST, 'No longer seen in FC'));
      }
    }
    promises.push(memberRepo.delete(member));
    promises.push(
      charRepo.query(`UPDATE ffxiv_char SET firstSeenApi = NULL, lastSeenApi = NULL WHERE id = ${member.character.id}`),
    );
    await Promise.all(promises);
  }
};

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
  },
];

export default jobs;
