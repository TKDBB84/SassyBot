import { CollectorFilter, Message, MessageCollector, MessageReaction, User } from 'discord.js';
import moment from 'moment';
import 'moment-timezone';
import { CoTPromotionChannelId, CotRanks, CoTRankValueToString, GuildIds, ONE_HOUR } from '../../../consts';
import PromotionRequest from '../../../entity/PromotionRequest';
import ActivityCommand from './ActivityCommand';
import getNumberOFDays from '../lib/GetNumberOfDays';

export default class PromoteCommand extends ActivityCommand {
  public readonly commands = ['promote', 'promotion'];
  protected getHelpText(): string {
    return `Usage: \`!sb promote -- I will mark you as requesting a promotion, the Officers review promotions when they can, and will finalize things.`;
  }

  protected async listAll(message: Message): Promise<void> {
    const promotionsRepo = this.sb.dbConnection.getRepository(PromotionRequest);
    const allPromotions = await promotionsRepo.find({ order: { requested: 'ASC' } });
    if (allPromotions.length === 0) {
      await message.channel.send('No Current Requests');
      return;
    }

    const reactionFilter: CollectorFilter = (reaction: MessageReaction, user: User): boolean => {
      return (reaction.emoji.name === '⛔' || reaction.emoji.name === '✅') && user.id === message.author.id;
    };

    const promotingMemberId = message.author.id;
    const promotingMember = await this.sb.getMember(GuildIds.COT_GUILD_ID, promotingMemberId);
    const promotionChannel = await this.sb.getTextChannel(CoTPromotionChannelId);
    await message.channel.send('__Current Promotion Requests:__\n');

    await Promise.all(
      allPromotions.map(async (promotion) => {
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
        const response = `${promotion.CotMember.character.name}\t${
          CoTRankValueToString[promotion.CotMember.rank]
        } ⇒ ${toRankName}\tDays In FC: ${getNumberOFDays(promotion.CotMember.character.firstSeenApi)}\tRequested ${
          daysAgo > 0 ? `${daysAgo} days ago` : 'today'
        }`;

        let sentMessageArray: Message[];
        const sentMessages = await message.channel.send(response, { split: false });
        if (!Array.isArray(sentMessages)) {
          sentMessageArray = [sentMessages];
        } else {
          sentMessageArray = sentMessages;
        }
        await Promise.all(
          sentMessageArray.map(async (sentMessage) => {
            const reactionYes = await sentMessage.react('✅');
            const reactionNo = await sentMessage.react('⛔');
            const collection = await sentMessage.awaitReactions(reactionFilter, {
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

              const member = await this.sb.getMember(GuildIds.COT_GUILD_ID, updatedMember.character.user.discordUserId);
              if (member && newRole) {
                let reason = `promoted`;
                if (promotingMember) {
                  reason += ` by ${promotingMember.displayName}`;
                }
                try {
                  await member.roles.add(newRole, reason);
                  await member.roles.remove(previousRole, reason);
                } catch (error) {
                  this.sb.logger.warn('error promoting member, adding/removing rank:', [
                    {
                      member,
                      newRole,
                      previousRole,
                    },
                    error,
                  ]);
                  await message.reply(
                    `I was unable to change ${promotion.CotMember.character.name}'s rank, please update it when you have a moment.`,
                  );
                }
              }

              if (promotionChannel) {
                await promotionChannel.send(`${promotion.CotMember.character.name} your promotion has been approved`);
              }
              await sentMessage.delete({ timeout: 100 });
            } else {
              await message.channel.send(
                `Please Remember To Follow Up With ${promotion.CotMember.character.name} On Why They Were Denied`,
              );
              await promotionsRepo.delete(promotion.id);
              await sentMessage.delete({ timeout: 100 });
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
      const messageCollector = new MessageCollector(message.channel, filter);
      messageCollector.on('collect', (collectedMessage: Message) => {
        const asyncWork = async () => {
          try {
            promotion.CotMember = await this.parseCharacterName(collectedMessage);
            await this.summarizeData(collectedMessage, promotion);
          } catch (error) {
            this.sb.logger.error('could not find cot member', error);
          } finally {
            messageCollector.stop();
          }
        };
        void asyncWork();
      });
    } else {
      const existingPromotion = await this.sb.dbConnection
        .getRepository(PromotionRequest)
        .findOne({ CotMember: foundMember });
      if (existingPromotion) {
        await message.channel.send(
          `You requested a promotion on ${existingPromotion.requested.toLocaleDateString('en-US', {
            day: 'numeric',
            month: 'short',
            timeZone: 'UTC',
            year: 'numeric',
          })}`,
        );
        await this.summarizeData(message, existingPromotion, true);
        return;
      }
      promotion.CotMember = foundMember;
      await this.summarizeData(message, promotion);
    }
  }

  protected async summarizeData(message: Message, promotion: PromotionRequest, nagString = false): Promise<void> {
    let toRankName;
    switch (promotion.CotMember.rank) {
      case CotRanks.VETERAN:
        await message.reply(
          "You're currently a Veteran already, there are no remaining promotions. Officer Ranks are handled as one-off special cases by FC leads.",
        );
        return;
      case CotRanks.MEMBER:
        promotion.toRank = CotRanks.VETERAN;
        toRankName = CoTRankValueToString[CotRanks.VETERAN];
        break;
      default:
      case CotRanks.RECRUIT:
        promotion.toRank = CotRanks.MEMBER;
        toRankName = CoTRankValueToString[CotRanks.MEMBER];
        break;
    }
    const savedPromotion = await this.sb.dbConnection.getRepository(PromotionRequest).save(promotion, { reload: true });
    const summary = `__Here's the data I have Stored:__ \n\n Character: ${
      savedPromotion.CotMember.character.name
    } \n Requesting Promotion To: ${toRankName} \n\n ${
      nagString
        ? 'The officers will review it as soon as they have time.'
        : "I'll make sure the officers see this request!"
    }`;
    await message.reply(summary, { reply: message.author, split: true });
  }
}
