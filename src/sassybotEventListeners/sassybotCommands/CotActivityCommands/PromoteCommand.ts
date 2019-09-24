import {Message, MessageCollector} from 'discord.js';
import ActivityCommand from './ActivityCommand';

export default class PromoteCommand extends ActivityCommand {
  public readonly command = 'promote';

  protected async listAll(message: Message): Promise<void> {
    return undefined;
  }

  protected async activityListener({message}: { message: Message }): Promise<void> {
    let messageCount = 0;
    await this.requestCharacterName(message);
    const filter = (filterMessage: Message) => filterMessage.author.id === message.author.id;
    const messageCollector = new MessageCollector(message.channel, filter);
    messageCollector.on('collect', async (collectedMessage: Message) => {
        await this.parseCharacterName(message);
        await this.summarizeData(message);
        messageCollector.stop();
    })
  }

  protected async parseCharacterName(message: Message): Promise<void> {
    return undefined;
  }
  protected async summarizeData(message: Message): Promise<void> {
    return;
  }
}
