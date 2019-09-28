import { Message, MessageCollector } from 'discord.js';
import ActivityCommand from './ActivityCommand';
import AbsentRequest from "../../../entity/AbsentRequest";
import COTMember from "../../../entity/COTMember";

export default class AbsentCommand extends ActivityCommand {
  public readonly command = 'absent';

  protected async listAll(message: Message): Promise<void> {
    return undefined;
  }

  protected async activityListener({ message }: { message: Message }): Promise<void> {
    const absent = new AbsentRequest();
    let messageCount = 0;
    await this.requestCharacterName(message);
    const filter = (filterMessage: Message) => filterMessage.author.id === message.author.id;
    const messageCollector = new MessageCollector(message.channel, filter);
    messageCollector.on('collect', async (collectedMessage: Message) => {
      switch (messageCount) {
        case 0:
          absent.CotMember = await this.parseCharacterName(collectedMessage);
          await this.requestStartDate(collectedMessage);
          break;
        case 1:
          const startDate = await this.parseStartDate(collectedMessage);
          if (!startDate) {
            await this.requestStartDate(collectedMessage);
            messageCount--;
          } else {
            absent.startDate = startDate;
            this.requestEndDate(collectedMessage);
          }
          break;
        case 2:
          const endDate = await this.parseEndDate(collectedMessage);
          if (!endDate) {
            await this.requestEndDate(collectedMessage);
            messageCount--;
          } else {
            absent.endDate = endDate;
            await this.summarizeData(collectedMessage);
            messageCollector.stop();
          }
          break;
      }
      messageCount++;
    });
  }

  protected async parseCharacterName(message: Message): Promise<COTMember> {
    return new COTMember(); // make lint happy
  }

  protected async requestStartDate(message: Message) {
    return message; // make lint happy
  }
  protected async parseStartDate(message: Message): Promise<Date | false> {
    return false; // make lint happy
  }
  protected async requestEndDate(message: Message) {
    return message; // make lint happy
  }
  protected async parseEndDate(message: Message): Promise<Date | false > {
    return new Date(); // make lint happy
  }

  protected async summarizeData(message: Message): Promise<void> {
    return;
  }
}
