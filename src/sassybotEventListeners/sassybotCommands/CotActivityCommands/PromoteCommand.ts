import { CollectorFilter, Message, MessageCollector, MessageReaction, ReactionEmoji, User } from 'discord.js';
import { CoTPromotionChannelId, CotRanks, CoTRankValueToString, ONE_HOUR } from '../../../consts';
import COTMember from '../../../entity/COTMember';
import PromotionRequest from '../../../entity/PromotionRequest';
import ActivityCommand from './ActivityCommand';

export default class PromoteCommand extends ActivityCommand {
  public readonly command = 'promote';

  protected async listAll(message: Message): Promise<void> {
    const reactionFilter: CollectorFilter = (reaction, user: User): boolean => {
      return (reaction.emoji.name === 'no' || reaction.emoji.name === '✅') && user.id === message.author.id;
    };
    const promotionChannel = await this.sb.getTextChannel(CoTPromotionChannelId);
    const promotionsRepo = this.sb.dbConnection.getRepository(PromotionRequest);
    const allPromotions = await promotionsRepo.find({ order: { requested: 'ASC' } });
    await message.channel.send('__Current Promotion Requests:__\n');
    await Promise.all(
      allPromotions.map(async (promotion) => {
        let toRankName;
        switch (promotion.CotMember.rank) {
          case CotRanks.MEMBER:
            toRankName = CoTRankValueToString[CotRanks.VETERAN];
            break;
          default:
          case CotRanks.RECRUIT:
            toRankName = CoTRankValueToString[CotRanks.MEMBER];
            break;
        }
        const response = `${promotion.CotMember.charName} From ${
          CoTRankValueToString[promotion.CotMember.rank]
        } To ${toRankName}`;
        let sentMessages = await message.channel.send(response);
        if (!Array.isArray(sentMessages)) {
          sentMessages = [sentMessages];
        }
        await Promise.all(
          sentMessages.map(async (sentMessage) => {
            const reactionYes = await sentMessage.react('✅');
            const reactionNo = await sentMessage.react('344861453146259466');
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
            if (collection.first() && collection.first().emoji.name === '✅') {
              if (promotionChannel) {
                await promotionChannel.send(`${promotion.CotMember.charName} your promotion has been approved`);
              }
              // do promotion
            } else {
              await message.channel.send(
                `Please Remember To Follow Up With ${promotion.CotMember.charName} On Why They Were Denied`,
              );
              await promotionsRepo.delete(promotion.id);
              await sentMessage.delete(100);
            }
            return Promise.resolve();
          }),
        );
      }),
    );
    await message.channel.send('', { split: true });
    return;
  }

  protected async activityListener({ message }: { message: Message }): Promise<void> {
    const promotion = new PromotionRequest();
    await this.requestCharacterName(message);
    const filter = (filterMessage: Message) => filterMessage.author.id === message.author.id;
    const messageCollector = new MessageCollector(message.channel, filter);
    messageCollector.on('collect', async (collectedMessage: Message) => {
      promotion.CotMember = await this.parseCharacterName(message);
      await this.summarizeData(message);
      messageCollector.stop();
    });
  }

  protected async parseCharacterName(message: Message): Promise<COTMember> {
    return new COTMember();
  }

  protected async summarizeData(message: Message): Promise<void> {
    return;
  }
}
