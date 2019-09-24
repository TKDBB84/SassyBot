import { Message, MessageCollector } from 'discord.js';
import ActivityCommand from './ActivityCommand';

export default class AbsentCommand extends ActivityCommand {
  public readonly command = 'absent';

  protected async listAll(message: Message): Promise<void> {
    return undefined;
  }

  protected async activityListener({ message }: { message: Message }): Promise<void> {
    let messageCount = 0;
    await this.requestCharacterName(message);
    const filter = (filterMessage: Message) => filterMessage.author.id === message.author.id;
    const messageCollector = new MessageCollector(message.channel, filter);
    messageCollector.on('collect', async (collectedMessage: Message) => {
      switch (messageCount) {
        case 0:
          await this.parseCharacterName(collectedMessage);
          await this.requestStartDate(collectedMessage);
          break;
        case 1:
          const gotStartDate = this.parseStartDate(collectedMessage);
          if (!gotStartDate) {
            await this.requestStartDate(collectedMessage);
            messageCount--;
          } else {
            this.requestEndDate(collectedMessage);
          }
          break;
        case 2:
          const gotEndDate = await this.parseEndDate(collectedMessage);
          if (gotEndDate) {
            await this.requestEndDate(collectedMessage);
            messageCount--;
          } else {
            await this.summarizeData(collectedMessage);
            messageCollector.stop();
          }
          break;
      }
      messageCount++;
    });
  }

  protected async parseCharacterName(message: Message): Promise<void> {
  }

  protected async requestStartDate(message: Message) {
    return message; // make lint happy
  }
  protected async parseStartDate(message: Message): Promise<boolean> {
    return true; // make lint happy
  }
  protected async requestEndDate(message: Message) {
    return message; // make lint happy
  }
  protected async parseEndDate(message: Message): Promise<boolean> {
    return true; // make lint happy
  }

  protected async summarizeData(message: Message): Promise<void> {
  }
}
