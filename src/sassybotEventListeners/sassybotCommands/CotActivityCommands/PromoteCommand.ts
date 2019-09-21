import { Message } from 'discord.js';
import ActivityCommand from './ActivityCommand';
import {ISassybotCommandParams} from "../../../Sassybot";

export default class PromoteCommand extends ActivityCommand {
  public readonly command = 'promote';

  protected async listAll(message: Message): Promise<void> {
    return undefined;
  }

  protected async activityCommandListener({
    message,
    params,
  }: { message: Message; params: ISassybotCommandParams }): Promise<void> {
    return undefined;
  }
}
