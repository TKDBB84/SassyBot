import { Message } from 'discord.js';
import ActivityResponseListener, { IActivityList } from './ActivityResponseListener';

export interface AbsentActivityList extends IActivityList {
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
  public activeRequestList: AbsentActivityList = {};
  protected async activityMessageListener({ message }: { message: Message }): Promise<void> {
    return undefined;
  }

  protected requestStartDate(message: Message) {}
  protected parseStartDate(message: Message) {}
  protected requestEndDate(message: Message) {}
  protected parseEndDate(message: Message) {}
}
