import { Message } from 'discord.js';
import SassybotEventListener from '../SassybotEventListener';
import * as moment from 'moment';
import { ISassybotCommandParams } from '../../Sassybot';

export interface IActivityList {
  [userId: string]: {
    next: (message: Message, activityList: IActivityList) => Promise<void>;
    guildId: string;
    initDate: Date;
    name: string;
  };
}

export interface InterfaceActivityResponseListener {
  activeRequestList: IActivityList;
}

export default abstract class ActivityResponseListener extends SassybotEventListener
  implements InterfaceActivityResponseListener {
  protected readonly event = 'messageReceived';
  protected readonly onEvent = this.listener;
  protected readonly intervalId = setInterval(this.removeExpiredEntries, 1000 * 60 * 5);
  public abstract activeRequestList: IActivityList;

  protected abstract async activityMessageListener({ message }: { message: Message }): Promise<void>;

  protected async listener({ message }: { message: Message }): Promise<void> {
    if (this.activeRequestList.hasOwnProperty(message.author.id)) {
      await this.activityMessageListener({ message });
    }
  }

  protected async requestCharacterName(message: Message) {
    if (this.activeRequestList[message.author.id]) {
    }
  }
  protected async parseCharacterName(message: Message, next: Function) {
    if (this.activeRequestList[message.author.id]) {
    }
  }

  protected async removeFromList(userId: string): Promise<void> {
    delete this.activeRequestList[userId];
  }

  protected async removeExpiredEntries() {
    const keys = Object.keys(this.activeRequestList);
    const fifteenMinAgo = new Date( Date.now() - 1000 * 60 * 15 );
    keys.forEach(key => {
      if (this.activeRequestList[key].initDate < fifteenMinAgo) {
        delete this.activeRequestList[key];
      }
    })
  }

}
