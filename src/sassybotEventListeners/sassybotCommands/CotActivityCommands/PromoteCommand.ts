import { CollectorFilter, Message, MessageCollector, User } from 'discord.js';
import * as moment from 'moment';
import 'moment-timezone';
import { CoTPromotionChannelId, CotRanks, CoTRankValueToString, GuildIds, ONE_HOUR } from '../../../consts';
import PromotionRequest from '../../../entity/PromotionRequest';
import ActivityCommand from './ActivityCommand';

export default class PromoteCommand extends ActivityCommand {
  public readonly commands = ['promote', 'promotion'];

  protected async listAll(message: Message): Promise<void> {
    const promotionsRepo = this.sb.dbConnection.getRepository(PromotionRequest);
    const allPromotions = await promotionsRepo.find({ order: { requested: 'ASC' } });
    if (allPromotions.length === 0) {
      await message.channel.send('No Current Requests');
      return;
    }

    const reactionFilter: CollectorFilter = (reaction, user: User): boolean => {
      return (reaction.emoji.name === '⛔' || reaction.emoji.name === '✅') && user.id === message.author.id;
    };

    const promotingMemberId = message.member?.id;
    if (!promotingMemberId) {
      await message.channel.send("You must have dm'd me, dont do that");
      return;
    }
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

        const firstSeen = moment(promotion.CotMember.character.firstSeenApi);
        const firstPull = moment(new Date(2019, 10, 11, 23, 59, 59));
        const beginningOfTime = moment(new Date(2019, 9, 2, 23, 59, 59));
        let daysInFc: string = '';
        if (firstSeen.isAfter(firstPull)) {
          daysInFc = `\tand has been in the FC for approx ${moment().diff(firstSeen, 'd')} days`;
        } else if (firstSeen.isBefore(beginningOfTime)) {
          daysInFc = '\tand was in the FC before Sassybot';
        } else if (firstSeen.isAfter(beginningOfTime) && firstSeen.isBefore(firstPull)) {
          daysInFc = `\tand has been in the FC somewhere between ${moment().diff(firstPull, 'd')} and ${moment().diff(
            beginningOfTime,
            'd',
          )} days`;
        }

        const response = `${promotion.CotMember.character.name} From ${
          CoTRankValueToString[promotion.CotMember.rank]
        } To ${toRankName} on ${promotion.requested.toLocaleDateString('en-US', {
          day: 'numeric',
          month: 'short',
          timeZone: 'UTC',
          year: 'numeric',
        })}${daysInFc}`;

        let sentMessageArray: Message[];
        const sentMessages = await message.channel.send(response, { split: true });
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
              const previousRole = await this.sb.getRole(GuildIds.COT_GUILD_ID, promotion.CotMember.rank);
              const updatedMember = await promotion.CotMember.promote();
              await promotionsRepo.delete(promotion.id);
              const newRole = await this.sb.getRole(GuildIds.COT_GUILD_ID, updatedMember.rank);

              const member = await this.sb.getMember(GuildIds.COT_GUILD_ID, updatedMember.character.user.discordUserId);
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
      messageCollector.on('collect', async (collectedMessage: Message) => {
        promotion.CotMember = await this.parseCharacterName(collectedMessage);
        await this.summarizeData(collectedMessage, promotion);
        messageCollector.stop();
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
        promotion.toRank = CotRanks.OFFICER;
        toRankName = CoTRankValueToString[CotRanks.OFFICER];
        break;
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
