import { Message } from 'discord.js';
import ActivityResponseListener, { IActivityList } from './ActivityResponseListener';

export interface IAbsentActivityList extends IActivityList {
  [userId: string]: {
    next: (message: Message, activityList: IActivityList) => Promise<void>;
    guildId: string;
    initDate: Date;
    name: string;
    startDate: Date;
    endDate: Date;
  };
}

export default class AbsentResponseListener extends ActivityResponseListener {
  public activeRequestList: IAbsentActivityList = {};
  protected async activityMessageListener({ message }: { message: Message }): Promise<void> {
    return undefined;
  }

  protected requestStartDate(message: Message) {
    return message; // make lint happy
  }
  protected parseStartDate(message: Message) {
    return message; // make lint happy
  }
  protected requestEndDate(message: Message) {
    return message; // make lint happy
  }
  protected parseEndDate(message: Message) {
    return message; // make lint happy
  }
}
