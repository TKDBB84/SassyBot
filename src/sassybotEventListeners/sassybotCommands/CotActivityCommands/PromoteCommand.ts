import { Message, MessageCollector } from 'discord.js';
import COTMember from '../../../entity/COTMember';
import PromotionRequest from '../../../entity/PromotionRequest';
import ActivityCommand from './ActivityCommand';

export default class PromoteCommand extends ActivityCommand {
  public readonly command = 'promote';

  protected async listAll(message: Message): Promise<void> {
    return undefined;
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
