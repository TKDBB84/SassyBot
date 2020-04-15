import * as http2 from 'http2';
import { LessThan } from 'typeorm';
import { CoTOfficerChannelId, CotRanks, GuildIds } from './consts';
import COTMember from './entity/COTMember';
import Event from './entity/Event';
import FFXIVChar from './entity/FFXIVChar';
import PromotionRequest from './entity/PromotionRequest';
import { Sassybot } from './Sassybot';

export interface IScheduledJob {
  job: (sb: Sassybot) => Promise<void>;
  schedule: string;
}

interface IFreeCompanyMember {
  Avatar: 'https://img2.finalfantasyxiv.com/f/9bb002c4984cb609a79dd28c4079c5d4_ce736afe35e2ded4e46c4fd0659aef7efc0_96x96.jpg';
  FeastMatches: number;
  ID: number;
  Name: string;
  Rank: 'MEMBER' | 'RECRUIT' | 'VETERAN' | 'OFFICER';
  RankIcon: string;
  Server: string;
}
const getLatestMemberList = (): Promise<IFreeCompanyMember[]> => {
  return new Promise((resolve) => {
    const client = http2.connect('https://xivapi.com:443');
    client.on('error', console.error);
    const req = client.request({
      ':path': `/freecompany/9229001536389012456?private_key=${process.env.XIV_API_TOKEN}&data=FCM`,
    });
    req.setEncoding('utf8');
    let responseBody = '';
    req.on('data', (chunk) => {
      responseBody += chunk;
    });
    req.on('end', () => {
      let finalResult: IFreeCompanyMember[] = [];
      try {
        const parsedBody = JSON.parse(responseBody);
        if (parsedBody.hasOwnProperty('FreeCompanyMembers')) {
          finalResult = parsedBody.FreeCompanyMembers;
        }
      } catch (err) {
        console.error({ context: 'Error From XIVAPI', err });
        finalResult = [];
      }
      client.close(() => {
        resolve(
          finalResult.map((r) => {
            const Rank = r.Rank.toUpperCase().trim();
            if (['FOUNDER', 'FCM', 'NOTMIA', 'OFFICER'].includes(Rank)) {
              return {
                ...r,
                Rank: 'OFFICER',
              };
            }
            if (Rank === 'DIGNITARY') {
              return {
                ...r,
                Rank: 'MEMBER',
              };
            }
            if (Rank === 'STEWARDS') {
              return {
                ...r,
                Rank: 'VETERAN',
              };
            }
            if (Rank === 'MEMBER' || Rank === 'VETERAN') {
              return {
                ...r,
                Rank,
              };
            }
            return {
              ...r,
              Rank: 'RECRUIT',
            };
          }),
        );
      });
    });
    req.end();
  });
};

const updateCotMembersFromLodeStone = async (sb: Sassybot) => {
  const pullTime = new Date();
  const lodestoneMembers = await getLatestMemberList();
  const cotMemberRepo = sb.dbConnection.getRepository(COTMember);
  const characterRepo = sb.dbConnection.getRepository(FFXIVChar);

  for (let i = 0, iMax = lodestoneMembers.length; i < iMax; i++) {
    const lodestoneMember = lodestoneMembers[i];
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
    switch (CotRanks[lodestoneMember.Rank]) {
      case CotRanks.OFFICER:
        targetRank = CotRanks.OFFICER;
        break;
      case CotRanks.VETERAN:
        targetRank = CotRanks.VETERAN;
        break;
      case CotRanks.MEMBER:
        targetRank = CotRanks.MEMBER;
        break;
      default:
      case CotRanks.RECRUIT:
        targetRank = CotRanks.RECRUIT;
        break;
    }

    if (!cotMember) {
      await cotMemberRepo.query('INSERT INTO `cot_member` (`rank`, `characterId`) VALUES ($1, $2)', [
        targetRank,
        character.id,
      ]);
      cotMember = await cotMemberRepo.findOneOrFail({ where: { character: { id: character.id } } });
    } else {
      if (targetRank !== cotMember.rank) {
        await cotMemberRepo.update(cotMember.id, { rank: targetRank });
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
      } catch (e) {
        console.error("couldn't report to officers channel", { e });
      }
    }
  }
  return;
};

const deletePastEvents = async (sb: Sassybot) => {
  const eventRepo = sb.dbConnection.getRepository(Event);
  await eventRepo.delete({ eventTime: LessThan<Date>(new Date()) });
};

const twiceADay = '0 15 8,20 * * *';
const daily = '0 0 20 * * *';

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
];

export default jobs;
