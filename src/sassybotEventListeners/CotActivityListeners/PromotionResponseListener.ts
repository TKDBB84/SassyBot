import { Message } from 'discord.js';
import ActivityResponseListener, { IActivityList } from './ActivityResponseListener';

export default class PromotionResponseListener extends ActivityResponseListener {
  public activeRequestList: IActivityList = {};

  protected async listener({ message }: { message: Message }): Promise<void> {
    return undefined;
  }

  protected async parseCharacterName(message: Message) {
    if (this.activeRequestList[message.author.id]) {
      // do stuff
      this.removeFromList(message.author.id);
    }
  }
}
