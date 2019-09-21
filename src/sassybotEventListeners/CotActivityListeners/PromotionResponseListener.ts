import { Message } from 'discord.js';
import ActivityResponseListener, { IActivityList } from './ActivityResponseListener';

export default class PromotionResponseListener extends ActivityResponseListener {
  public activeRequestList: IActivityList = {};

  public async addToActivityList(message: Message) {
    this.activeRequestList[message.author.id] = {
      guildId: message.guild.id,
      initDate: new Date(),
      name: message.member.nickname,
      next: this.requestCharacterName,
    };
    await this.activeRequestList[message.author.id].next(message);
    this.activeRequestList[message.author.id].next = this.parseCharacterName;
  }

  protected async activityMessageListener({ message }: { message: Message }): Promise<void> {
    return undefined;
  }

  protected async parseCharacterName(message: Message) {
    if (this.activeRequestList[message.author.id]) {
      // do stuff
      this.removeFromList(message.author.id);
    }
  }
}
