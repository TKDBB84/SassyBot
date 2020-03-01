import { MessageReaction, ReactionEmoji } from 'discord.js';
import Quote from '../entity/Quote';
import SbUser from '../entity/SbUser';
import SassybotEventListener from './SassybotEventListener';

export default class QuoteListener extends SassybotEventListener {
  public readonly event = 'messageReactionAdd';
  public getEventListener() {
    return this.listener.bind(this);
  }

  protected async listener({ messageReaction }: { messageReaction: MessageReaction }): Promise<void> {
    const quoteStrings = ['quote', 'quote-1'];
    const reaction = messageReaction.emoji as ReactionEmoji;
    if (quoteStrings.includes(reaction.name)) {
      const quoteRepo = this.sb.dbConnection.getRepository(Quote);
      const sbUserRepo = this.sb.dbConnection.getRepository(SbUser);
      const alreadyQuoted = await quoteRepo.findOne({ messageId: messageReaction.message.id });
      if (alreadyQuoted) {
        return;
      }
      let sbUser = await sbUserRepo.findOne({ discordUserId: messageReaction.message.author.id });
      if (!sbUser) {
        sbUser = new SbUser();
        sbUser.discordUserId = messageReaction.message.author.id;
        await sbUserRepo.save(sbUser);
      }
      const sbQuote = new Quote();
      sbQuote.user = sbUser;
      sbQuote.quoteText = messageReaction.message.cleanContent;
      sbQuote.channelId = messageReaction.message.channel.id;
      sbQuote.guildId = messageReaction.message.guild?.id || '';
      sbQuote.messageId = messageReaction.message.id;
      const savedQuote = await quoteRepo.save(sbQuote, { reload: true });
      const quotedMember = await this.sb.getMember(savedQuote.guildId, savedQuote.user.discordUserId);
      if (quotedMember) {
        await messageReaction.message.channel.send(
          `I've noted that ${quotedMember.displayName} said: "${savedQuote.quoteText}"`,
          { split: true },
        );
      }
    }
  }
}
