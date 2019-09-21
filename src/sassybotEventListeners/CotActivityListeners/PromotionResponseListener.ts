import { Message } from 'discord.js';
import ActivityResponseListener, { IActivityList } from './ActivityResponseListener';

export default class PromotionResponseListener extends ActivityResponseListener {
  public activeRequestList: IActivityList = {};

  protected async activityMessageListener({ message }: { message: Message }): Promise<void> {
    return undefined;
  }
}
