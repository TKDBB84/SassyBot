/* eslint-disable @typescript-eslint/ban-ts-comment, @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access */
// disabled for XIVApi
import moment from 'moment';
import { DeleteResult, Equal, In, LessThan, UpdateResult } from 'typeorm';
import { CoTAPIId, CoTOfficerChannelId, CotRanks, GuildIds } from './consts';
import COTMember from './entity/COTMember';
import Event from './entity/Event';
import FFXIVChar from './entity/FFXIVChar';
import PromotionRequest from './entity/PromotionRequest';
import { Sassybot } from './Sassybot';
import { DiscordAPIError, GuildMember } from 'discord.js';
import AbsentRequest from './entity/AbsentRequest';
import fetch from 'node-fetch';

export type IJob = (sb: Sassybot) => Promise<void>;

export interface IScheduledJob {
  job: IJob;
  schedule: string;
}

interface IFreeCompanyMember {
  Avatar: string;
  ID: number;
  Name: string;
  FcRank: string;
  Rank: 'MEMBER' | 'RECRUIT' | 'VETERAN' | 'OFFICER';
  RankIcon: string;
  exactRecruit: boolean;
}

const getLatestMemberList = async (sb: Sassybot): Promise<IFreeCompanyMember[]> => {
  const redisCache = await sb.getRedis();
  try {
    const result = await fetch(`http://nodestone:8080/freecompany/${CoTAPIId}?data=FCM`).then((res) => {
      if (res.ok) {
        return res.json();
      }
      throw new Error(`${res.status} ${res.statusText}`);
    });
    if (result && result.FreeCompanyMembers && result.FreeCompanyMembers.List) {
      await redisCache.set('lastSuccessfulMemberPull', new Date().toUTCString());
      await redisCache.set('memberPullFailCount', '0');
      return result.FreeCompanyMembers.map((member: IFreeCompanyMember) => {
        const Rank = member.FcRank.toUpperCase().trim();
        switch (Rank) {
          case 'FOUNDER':
          case 'PUPPET':
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
      }) as IFreeCompanyMember[];
    } else {
      const redisCache = await sb.getRedis();
      let failCount = await redisCache.get('memberPullFailCount');
      if (!failCount) {
        failCount = '0';
      }
      const failCountInt = parseInt(failCount, 10) + 1;
      await redisCache.set('memberPullFailCount', failCountInt.toString());
      if (failCountInt >= 5) {
        sb.logger.error(`Error getting latest member list ${failCountInt} times in a row`);
      }
    }
  } catch (err) {
    sb.logger.error('Could not fetch member list', err);
  }
  return [];
};

const maybeRetryMemberList: IJob = async (sb: Sassybot) => {
  const currentTime = moment();
  const redisCache = await sb.getRedis();
  const isRunning = await redisCache.get('memberPullRunning');
  const lastPull = await redisCache.get('lastSuccessfulMemberPull');
  if (lastPull && !isRunning) {
    const hourDiff = Math.abs(moment(lastPull).diff(currentTime, 'h'));
    if (hourDiff > 2) {
      return updateCotMembersFromLodeStone(sb);
    }
  }
};

const updateCotMembersFromLodeStone: IJob = async (sb: Sassybot) => {
  const pullTime = new Date();
  const redisCache = await sb.getRedis();
  await redisCache.set('memberPullRunning', 1);
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
      character = await characterRepo.findOneOrFail({ where: { id: characterData.id }, relations: [] });
      if (characterData.firstSeenApi && characterData.firstSeenApi < new Date('1900-01-01')) {
        characterData.firstSeenApi = pullTime;
      }
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
      } catch (e: unknown) {
        // user no longer in discord
        if (e instanceof DiscordAPIError) {
          if (e.message === 'Unknown Member' && e.code === 10007 && e.status === 404 && character.id) {
            void (await characterRepo.update({ id: character.id }, { user: null }));
          } else {
            sb.logger.error('message', e);
          }
        }
      }
    }
  }
  await redisCache.del('memberPullRunning');
};

const checkForReminders: IJob = async (sb: Sassybot) => {
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
      `Hi ${officeRole.toString()}, I'm just here to let you know that there ${isAre} currently ${oldPromotionCount} promotion request${sOrEmpty} that ${isAre} more than 20 days old.`,
    );
  }
};

const deletePastEvents: IJob = async (sb: Sassybot) => {
  const eventRepo = sb.dbConnection.getRepository(Event);
  const YESTERDAY = new Date();
  YESTERDAY.setTime(new Date().getTime() - 24 * (60 * 60 * 1000));
  await eventRepo.delete({ eventTime: LessThan<Date>(YESTERDAY) });
};

const deletePastAbsences: IJob = async (sb: Sassybot) => {
  const absentRepo = sb.dbConnection.getRepository(AbsentRequest);
  const YESTERDAY = new Date();
  YESTERDAY.setTime(new Date().getTime() - 24 * (60 * 60 * 1000));
  await absentRepo.delete({ endDate: LessThan<Date>(YESTERDAY) });
};

const cleanUpOldMembers: IJob = async (sb: Sassybot) => {
  const nowMoment = moment();
  const FIFTEEN_DAYS_AGO = nowMoment.subtract(15, 'days').toDate();
  const SIXTY_ONE_DAYS_AGO = nowMoment.subtract(61, 'days').toDate();
  const ONE_HUNDRED_EIGHTY_ONE_DAYS_AGO = nowMoment.subtract(181, 'days').toDate();

  const charRepo = sb.dbConnection.getRepository(FFXIVChar);
  const memberRepo = sb.dbConnection.getRepository(COTMember);

  const relevantMembers = await memberRepo.find({
    where: { rank: In<CotRanks>([CotRanks.VETERAN, CotRanks.MEMBER, CotRanks.RECRUIT]) },
  });

  const allLostMembers = relevantMembers.filter((member) => {
    if (moment(member.character.lastSeenApi).isBefore('1900-01-01 00:00:00')) {
      return false;
    }
    switch (member.rank) {
      case CotRanks.VETERAN:
        return !!member.character.lastSeenApi && member.character.lastSeenApi < ONE_HUNDRED_EIGHTY_ONE_DAYS_AGO;
      case CotRanks.MEMBER:
        return !!member.character.lastSeenApi && member.character.lastSeenApi < SIXTY_ONE_DAYS_AGO;
      case CotRanks.RECRUIT:
      default:
        return !!member.character.lastSeenApi && member.character.lastSeenApi < FIFTEEN_DAYS_AGO;
    }
  });

  for (let i = 0, iMax = allLostMembers.length; i < iMax; i++) {
    const member = allLostMembers[i];
    const discordId = member.character.user?.discordUserId;
    const promises: Promise<DeleteResult | UpdateResult | GuildMember>[] = [];
    if (discordId) {
      const discordMember: GuildMember | undefined | false = await sb
        .getMember(GuildIds.COT_GUILD_ID, discordId)
        .catch(() => false);

      const promotionsRepo = sb.dbConnection.getRepository<PromotionRequest>(PromotionRequest);
      const promotions = await promotionsRepo.find({ where: { CotMember: Equal(member.id) } });
      if (promotions) {
        promotions.forEach((promotion) => {
          promises.push(promotionsRepo.delete(promotion.id));
        });
      }

      if (discordMember) {
        promises.push(
          discordMember.roles.remove([CotRanks.VETERAN, CotRanks.MEMBER, CotRanks.RECRUIT], 'No longer seen in FC'),
        );
        promises.push(discordMember.roles.add(CotRanks.GUEST, 'No longer seen in FC'));
      }
    }
    sb.logger.info(
      `Removing Member: ${member.character.name} - Last Seen ${member.character.lastSeenApi.toISOString()}`,
      { member },
    );
    promises.push(memberRepo.delete(member.id));

    promises.push(
      charRepo.update(
        { id: member.character.id },
        { firstSeenApi: '1000-01-01 00:00:00', lastSeenApi: '1000-01-01 00:00:00' },
      ),
    );
    void (await Promise.all(promises));
  }
};

const twiceADay = '0 15 8,20 * * *';
const daily = '0 0 20 * * *';
const afterTwiceADay = '0 30 8,20 * * *';
const every15Min = '0 0,15,30,45 * * * *';

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
  {
    job: maybeRetryMemberList,
    schedule: every15Min,
  },
];

export default jobs;
