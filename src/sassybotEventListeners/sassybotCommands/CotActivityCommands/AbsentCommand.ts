import { Message } from 'discord.js';
import { Sassybot } from '../../../Sassybot';
import AbsentResponseListener from '../../CotActivityListeners/AbsentResponseListener';
import ActivityCommand from './ActivityCommand';

export default class AbsentCommand extends ActivityCommand {
  public readonly command = 'absent';
  protected readonly activityListener: AbsentResponseListener;

  constructor(sb: Sassybot) {
    super(sb);
    this.command = 'absent';
    this.activityListener = new AbsentResponseListener(sb);
    this.activityListener.init();
  }

  protected async listAll(message: Message): Promise<void> {
    return undefined;
  }
}
