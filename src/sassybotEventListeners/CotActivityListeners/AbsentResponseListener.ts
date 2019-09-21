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
    this.activeRequestList[message.author.id] = {
      endDate: new Date(0),
      guildId: message.guild.id,
      initDate: new Date(),
      name: message.member.nickname,
      next: this.requestCharacterName,
      startDate: new Date(0),
    };
    await this.requestCharacterName(message);
    this.activeRequestList[message.author.id].next = this.parseCharacterName;
  }
  protected async activityMessageListener({ message }: { message: Message }): Promise<void> {
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
      message.channel.send('');
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
      message.channel.send('');
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
