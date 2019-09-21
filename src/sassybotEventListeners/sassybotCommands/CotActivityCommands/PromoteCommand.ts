import { Message } from 'discord.js';
import { ISassybotCommandParams } from '../../../Sassybot';
import ActivityCommand from './ActivityCommand';

export default class PromoteCommand extends ActivityCommand {
  public readonly command = 'promote';

  protected async listAll(message: Message): Promise<void> {
    return undefined;
  }

  protected async activityCommandListener({
    message,
    params,
  }: {
    message: Message;
    params: ISassybotCommandParams;
  }): Promise<void> {
    return undefined;
  }
}
