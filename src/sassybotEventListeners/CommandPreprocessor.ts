import { Message } from 'discord.js';
import SassybotEventListener from './SassybotEventListener';
import SbUser from '../entity/SbUser';

export default class CommandPreprocessor extends SassybotEventListener {
  public readonly event = 'sassybotCommandPreprocess';
  public getEventListener(): ({ message }: { message: Message }) => Promise<void> {
    return this.listener.bind(this);
  }

  protected async listener({ message }: { message: Message }): Promise<void> {
    const authorId = message.author.id;
    const userRepo = this.sb.dbConnection.getRepository<SbUser>(SbUser);
    const sbUser = await userRepo.findOne({ discordUserId: authorId });
    if (!sbUser) {
      await userRepo.save(userRepo.create({ discordUserId: authorId }));
    }
  }
}
