import * as sqliteDb from 'better-sqlite3';
import { Database } from 'better-sqlite3';
import * as moment from 'moment';
import { CotRanks, GuildIds } from './consts';
import AbsentRequest from './entity/AbsentRequest';
import COTMember from './entity/COTMember';
import FFXIVChar from './entity/FFXIVChar';
import PromotionRequest from './entity/PromotionRequest';
import { Sassybot } from './Sassybot';

export default class Migrate {
  private static matchRank(memberRank: string) {
    switch (memberRank.toUpperCase()) {
      case 'NOTMIA':
      case 'PERFECT LEGEND':
      case 'OFFICER':
      case 'FOUNDER':
        return CotRanks.OFFICER;
      case 'DIGNITARY':
        return CotRanks.DIGNITARY;
      case 'STEWARDS':
      case 'VETERAN':
        return CotRanks.VETERAN;
      case 'MEMBER':
        return CotRanks.MEMBER;
      default:
      case 'TOXIC WASTE':
      case 'RECRUIT':
        return CotRanks.RECRUIT;
    }
  }

  private sb: Sassybot;
  private sqlite: Database;

  constructor(sb: Sassybot) {
    this.sb = sb;
    this.sqlite = new sqliteDb('/home/nodebot/data/nodebot.sqlite', { readonly: true });
  }

  public async migrateAll() {
    await this.moveCotMembers();
    await this.moveAbsencesPromotions();
  }

  private async moveAbsencesPromotions() {
    const stmtGetAbsentRequests = this.sqlite.prepare('SELECT * FROM user_absent');
    const allAbsents = stmtGetAbsentRequests.all();
    await Promise.all(
      allAbsents.map(async (absent) => {
        const member = await COTMember.getCotMemberByName(absent.name, absent.user_id);
        const absence = new AbsentRequest();
        absence.CotMember = member;
        absence.startDate = new Date(absent.start_date);
        absence.endDate = new Date(absent.end_date);

        await this.sb.dbConnection.getRepository(AbsentRequest).save(absence);
      }),
    );

    const stmtGetPromotionRequests = this.sqlite.prepare('SELECT * FROM user_promote');
    const allPromotions = stmtGetPromotionRequests.all();
    await Promise.all(
      allPromotions.map(async (promotion) => {
        const member = await COTMember.getCotMemberByName(promotion.name, promotion.user_id);
        const promotionRequest = new PromotionRequest();
        promotionRequest.CotMember = member;
        promotionRequest.requested = moment(promotion.timestamp).toDate();
        switch (member.rank) {
          case CotRanks.MEMBER:
            promotionRequest.toRank = CotRanks.VETERAN;
            break;
          default:
          case CotRanks.RECRUIT:
            promotionRequest.toRank = CotRanks.MEMBER;
            break;
        }
        await this.sb.dbConnection.getRepository(PromotionRequest).save(promotionRequest);
      }),
    );
  }

  private async moveCotMembers() {
    const stmtGetMembers = this.sqlite.prepare('SELECT * FROM cot_members');
    const allOldMembers = stmtGetMembers.all();
    const discordKnownMembers = allOldMembers.filter((m) => m && m.user_id);
    const unknownMembers = allOldMembers.filter((m) => m && !m.user_id);

    await Promise.all(
      discordKnownMembers.map(async (member) => {
        const discordMember = await this.sb.getMember(GuildIds.COT_GUILD_ID, member.user_id);
        if (!discordMember) {
          return;
        }

        const cotMember = await COTMember.getCotMemberByName(
          member.name.trim(),
          member.user_id,
          Migrate.matchRank(member.rank),
        );
        const previousFirstSeen = moment(member.first_seen_api);
        const previousLastSeen = moment(member.last_seen_api);
        const currentFirstSeen = moment(cotMember.character.firstSeenApi);
        const currentLastSeen = moment(cotMember.character.lastSeenApi);

        if (previousFirstSeen.isBefore(currentFirstSeen)) {
          cotMember.character.firstSeenApi = previousFirstSeen.toDate();
        }

        if (previousLastSeen.isBefore(currentLastSeen)) {
          cotMember.character.lastSeenApi = previousLastSeen.toDate();
        }
        await this.sb.dbConnection.getRepository(FFXIVChar).save(cotMember.character);
      }),
    );

    await Promise.all(
      unknownMembers.map(async (member) => {
        let ffXIVChar = await this.sb.dbConnection.getRepository(FFXIVChar).findOne({ apiId: member.api_id });
        if (!ffXIVChar) {
          ffXIVChar = new FFXIVChar();
          ffXIVChar.apiId = member.api_id;
          ffXIVChar.name = member.name;
        }

        const previousFirstSeen = moment(member.first_seen_api);
        const previousLastSeen = moment(member.last_seen_api);
        const currentFirstSeen = moment(ffXIVChar.firstSeenApi);
        const currentLastSeen = moment(ffXIVChar.lastSeenApi);

        if (previousFirstSeen.isBefore(currentFirstSeen)) {
          ffXIVChar.firstSeenApi = previousFirstSeen.toDate();
        }

        if (previousLastSeen.isBefore(currentLastSeen)) {
          ffXIVChar.lastSeenApi = previousLastSeen.toDate();
        }

        ffXIVChar = await this.sb.dbConnection.getRepository(FFXIVChar).save(ffXIVChar);

        let cotMember = await this.sb.dbConnection
          .getRepository(COTMember)
          .createQueryBuilder()
          .where('characterId = :id', { id: ffXIVChar.id })
          .getOne();
        if (!cotMember) {
          cotMember = new COTMember();
        }
        cotMember.character = ffXIVChar;
        cotMember.rank = Migrate.matchRank(member.rank);
        await this.sb.dbConnection.getRepository(COTMember).save(cotMember);
      }),
    );
  }
}
