import { Message } from 'discord.js';
import { Sassybot } from '../../../Sassybot';
import PromotionResponseListener from '../../CotActivityListeners/PromotionResponseListener';
import ActivityCommand from './ActivityCommand';

export default class PromoteCommand extends ActivityCommand {
  public readonly command = 'promote';
  protected readonly activityListener: PromotionResponseListener;

  constructor(sb: Sassybot) {
    super(sb);
    this.command = 'promote';
    this.activityListener = new PromotionResponseListener(sb);
    this.activityListener.init();
  }

  protected async listAll(message: Message): Promise<void> {
    return undefined;
  }
}
