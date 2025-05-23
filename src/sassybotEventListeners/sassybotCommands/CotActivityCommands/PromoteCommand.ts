import { Message, MessageCollector, MessageReaction, User } from 'discord.js';
import moment from 'moment';
import 'moment-timezone';
import {
  CoTPromotionChannelId,
  CotRanks,
  CoTRankValueToString,
  GuildIds,
  ONE_HOUR,
  DaysForPromotionTo,
} from '../../../consts';
import PromotionRequest from '../../../entity/PromotionRequest';
import ActivityCommand from './ActivityCommand';
import getNumberOFDays from '../lib/GetNumberOfDays';

export default class PromoteCommand extends ActivityCommand {
  protected getHelpText(): string {
    return `Usage: \`!sb promote -- I will mark you as requesting a promotion, the Officers review promotions when they can, and will finalize things.`;
  }

  public readonly commands = ['promote', 'promotion'];

  protected async listAll(message: Message): Promise<void> {
    if (!message.channel.isSendable()) {
      return;
    }

    // const xiv = new XIVApi({ private_key: process.env.XIV_API_TOKEN, language: 'en' });
    const promotionsRepo = this.sb.dbConnection.getRepository(PromotionRequest);
    const allPromotions = await promotionsRepo.find({ order: { requested: 'ASC' } });
    if (allPromotions.length === 0) {
      await message.channel.send('No Current Requests');
      return;
    }

    const reactionFilter = (reaction: MessageReaction, user: User): boolean => {
      return (reaction.emoji.name === '⛔' || reaction.emoji.name === '✅') && user.id === message.author.id;
    };

    const promotingMemberId = message.author.id;
    const promotingMember = await this.sb.getMember(GuildIds.COT_GUILD_ID, promotingMemberId);
    const promotionChannel = await this.sb.getTextChannel(CoTPromotionChannelId);
    await message.channel.send({ content: '__Current Promotion Requests:__', reply: { messageReference: message } });
    // const memberList = (await xiv.freecompany.get(CoTAPIId, { data: 'FCM' })) as {
    //   FreeCompanyMembers: IFreeCompanyMember[];
    // };
    // let includeApiIds: number[] = [];
    // if (memberList && memberList.FreeCompanyMembers) {
    //   includeApiIds = memberList.FreeCompanyMembers.map((member: IFreeCompanyMember) => member.ID);
    // }

    await Promise.all(
      allPromotions.map(async (promotion) => {
        // if (includeApiIds.length && !includeApiIds.includes(promotion.CotMember.character.apiId)) {
        //   return promotionsRepo.delete(promotion.id);
        // }
        let toRankName;
        switch (promotion.CotMember.rank) {
          case CotRanks.VETERAN:
            toRankName = CoTRankValueToString[CotRanks.OFFICER];
            break;
          case CotRanks.MEMBER:
            toRankName = CoTRankValueToString[CotRanks.VETERAN];
            break;
          default:
          case CotRanks.RECRUIT:
            toRankName = CoTRankValueToString[CotRanks.MEMBER];
            break;
        }

        const daysAgo = moment().diff(promotion.requested, 'd');
        const content = `${promotion.CotMember.character.name}\t${
          CoTRankValueToString[promotion.CotMember.rank]
        } ⇒ ${toRankName}\tDays In FC: ${getNumberOFDays(promotion.CotMember.character.firstSeenApi)}\tRequested ${
          daysAgo > 0 ? `${daysAgo} days ago` : 'today'
        }`;

        let sentMessageArray: Message[];
        if (!message.channel.isSendable()) {
          return;
        }
        const sentMessages = await message.channel.send({ content });
        if (!Array.isArray(sentMessages)) {
          sentMessageArray = [sentMessages];
        } else {
          sentMessageArray = sentMessages;
        }
        await Promise.all(
          sentMessageArray.map(async (sentMessage) => {
            const reactionYes = await sentMessage.react('✅');
            const reactionNo = await sentMessage.react('⛔');
            const collection = await sentMessage.awaitReactions({
              filter: reactionFilter,
              max: 1,
              maxEmojis: 1,
              maxUsers: 1,
              time: ONE_HOUR * 2,
            });
            if (!collection || collection.size === 0) {
              await Promise.all([reactionYes.remove(), reactionNo.remove()]);
              return Promise.resolve();
            }
            const firstItem = collection.first();
            if (firstItem && firstItem.emoji.name === '✅') {
              const previousRole = promotion.CotMember.rank;
              const updatedMember = await promotion.CotMember.promote();
              await promotionsRepo.delete(promotion.id);
              const newRole = updatedMember.rank;
              const userDiscordId = updatedMember.character.user?.discordUserId || false;
              if (userDiscordId) {
                const member = await this.sb.getMember(GuildIds.COT_GUILD_ID, userDiscordId);
                if (member && newRole) {
                  let reason = `promoted`;
                  if (promotingMember) {
                    reason += ` by ${promotingMember.displayName}`;
                  }
                  try {
                    await member.roles.add(newRole, reason);
                    if (previousRole) {
                      await member.roles.remove(previousRole, reason);
                    }
                  } catch (error) {
                    this.sb.logger.warn('error promoting member, adding/removing rank:', {
                      error,
                      member,
                      newRole,
                      previousRole,
                    });
                    await message.reply(
                      `I was unable to change ${promotion.CotMember.character.name}'s rank, please update it when you have a moment.`,
                    );
                  }
                }
              }

              if (promotionChannel) {
                await promotionChannel.send(`${promotion.CotMember.character.name} your promotion has been approved`);
              }
              setTimeout(() => void sentMessage.delete(), 100);
            } else {
              if (!message.channel.isSendable()) {
                return;
              }
              await message.channel.send(
                `Please Remember To Follow Up With ${promotion.CotMember.character.name} On Why They Were Denied`,
              );
              await promotionsRepo.delete(promotion.id);
              setTimeout(() => void sentMessage.delete(), 100);
            }
            return Promise.resolve();
          }),
        );
      }),
    );
    return;
  }

  protected async activityListener({ message }: { message: Message }): Promise<void> {
    if (!this.sb.isTextChannel(message.channel)) {
      return;
    }
    const promotion = new PromotionRequest();
    promotion.requested = new Date();

    const foundMember = await this.sb.findCoTMemberByDiscordId(message.author.id);
    if (!foundMember) {
      await this.requestCharacterName(message);
      const filter = (filterMessage: Message) => filterMessage.author.id === message.author.id;
      const messageCollector = new MessageCollector(message.channel, { filter, idle: 120000 });
      messageCollector.on('collect', (collectedMessage: Message) => {
        const asyncWork = async () => {
          promotion.CotMember = await this.parseCharacterName(collectedMessage);
          const isEligible = await this.verifyEligibility(collectedMessage, promotion);
          if (isEligible) {
            await this.summarizeData(collectedMessage, promotion);
            messageCollector.stop();
          }
        };
        void asyncWork();
      });
    } else {
      const existingPromotion = await this.sb.dbConnection
        .getRepository(PromotionRequest)
        .findOne({ where: { CotMember: { id: foundMember.id } } });
      if (existingPromotion) {
        await message.channel.send(
          `You already requested a promotion on ${existingPromotion.requested.toLocaleDateString('en-US', {
            day: 'numeric',
            month: 'short',
            timeZone: 'UTC',
            year: 'numeric',
          })} that is waiting for review, the officers will get to it as soon as they can.`,
        );
        await this.summarizeData(message, existingPromotion, true);
        return;
      }
      promotion.CotMember = foundMember;
      const isEligible = await this.verifyEligibility(message, promotion);
      if (isEligible) {
        await this.summarizeData(message, promotion);
      }
    }
  }

  protected async verifyEligibility(message: Message, promotion: PromotionRequest): Promise<boolean> {
    if (promotion.CotMember.rank === CotRanks.VETERAN) {
      await message.reply(
        "You're currently a Veteran already, there are no remaining promotions. Officer Ranks are handled as one-off special cases by FC leads.",
      );
      return false;
    }
    const toRank = this.getToRank(promotion);
    const numDays = getNumberOFDays(promotion.CotMember.character.firstSeenApi);
    const numDaysTolerance = 5;
    if (numDays + numDaysTolerance < DaysForPromotionTo[toRank]) {
      await message.reply(
        `You appear to be ineligible for a promotion to ${CoTRankValueToString[toRank]}. You seem to have only been a member for ${numDays} days, when ${DaysForPromotionTo[toRank]} days are required.`,
      );
      return false;
    }
    return true;
  }

  protected async summarizeData(message: Message, promotion: PromotionRequest, nagString = false): Promise<void> {
    promotion.toRank = this.getToRank(promotion);
    const savedPromotion = await this.sb.dbConnection.getRepository(PromotionRequest).save(promotion, { reload: true });
    const summary = `__Here's the data I have Stored:__ \n\n Character: ${
      savedPromotion.CotMember.character.name
    } \n Requesting Promotion To: ${CoTRankValueToString[promotion.toRank]} \n\n ${
      nagString
        ? 'The officers will review it as soon as they have time.'
        : "I'll make sure the officers see this request!"
    }`;
    await message.reply({ content: summary });
  }

  protected getToRank(promotion: PromotionRequest): CotRanks.VETERAN | CotRanks.MEMBER {
    switch (promotion.CotMember.rank) {
      case CotRanks.VETERAN:
      case CotRanks.MEMBER:
        return CotRanks.VETERAN;
      default:
      case CotRanks.RECRUIT:
        return CotRanks.MEMBER;
    }
  }
}
