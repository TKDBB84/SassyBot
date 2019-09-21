import { Message } from 'discord.js';
import ActivityResponseListener, { IActivityList } from './ActivityResponseListener';

export interface IAbsentActivityList extends IActivityList {
  [userId: string]: {
    endDate: Date;
    guildId: string;
    initDate: Date;
    name: string;
    next: (message: Message) => Promise<void>;
    startDate: Date;
  };
}

export default class AbsentResponseListener extends ActivityResponseListener {
  public activeRequestList: IAbsentActivityList = {};

  public async addToActivityList(message: Message) {
    super.addToActivityList(message);
    this.activeRequestList[message.author.id].endDate = new Date(0);
    this.activeRequestList[message.author.id].startDate = new Date(0);
  }
  protected async listener({ message }: { message: Message }): Promise<void> {
    if (this.activeRequestList.hasOwnProperty(message.author.id)) {
      await this.activeRequestList[message.author.id].next(message);
    }
  }

  protected async parseCharacterName(message: Message) {
    if (this.activeRequestList[message.author.id]) {
      // do stuff

      await this.requestStartDate(message);
      this.activeRequestList[message.author.id].next = this.parseStartDate;
    }
  }

  protected async requestStartDate(message: Message): Promise<void> {
    if (this.activeRequestList[message.author.id]) {
      message.channel.send(
        "What's the first day you'll be gone?\n(because i'm a dumb bot, please format it as YYYY-MM-DD)",
      );
    }
  }
  protected async parseStartDate(message: Message): Promise<void> {
    if (this.activeRequestList[message.author.id]) {
      // do stuff

      await this.requestEndDate(message);
      this.activeRequestList[message.author.id].next = this.parseEndDate;
    }
  }
  protected async requestEndDate(message: Message): Promise<void> {
    if (this.activeRequestList[message.author.id]) {
      message.channel.send(
        "What day will you be back?\nIf you're not sure add a few days on the end\n(because i'm a dumb bot, please format it as YYYY-MM-DD)",
      );
    }
  }

  protected async parseEndDate(message: Message): Promise<void> {
    if (this.activeRequestList[message.author.id]) {
      // do stuff

      await this.requestStartDate(message);
      this.removeFromList(message.author.id);
    }
  }
}
