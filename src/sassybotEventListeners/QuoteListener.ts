import { MessageReaction, ReactionEmoji } from 'discord.js';
import Quote from '../entity/Quote';
import SassybotEventListener from './SassybotEventListener';

export default class QuoteListener extends SassybotEventListener {
  public readonly event = 'messageReactionAdd';
  public getEventListener(): ({ messageReaction }: { messageReaction: MessageReaction }) => Promise<void> {
    return this.listener.bind(this);
  }

  protected async listener({ messageReaction }: { messageReaction: MessageReaction }): Promise<void> {
    const quoteStrings = ['quote', 'quote-1'];
    const reaction = messageReaction.emoji as ReactionEmoji;
    if (quoteStrings.includes(reaction.name || '')) {
      const quoteRepo = this.sb.dbConnection.getRepository(Quote);
      const alreadyQuoted = await quoteRepo.findOne({ messageId: messageReaction.message.id });
      if (alreadyQuoted) {
        return;
      }
      const authorId = messageReaction.message.author?.id;
      const quoteText = messageReaction.message.cleanContent || '';
      if (authorId && quoteText) {
        const sbUser = await this.sb.maybeCreateSBUser(authorId);
        const sbQuote = new Quote();
        sbQuote.user = sbUser;
        sbQuote.quoteText = quoteText;
        sbQuote.channelId = messageReaction.message.channel.id;
        sbQuote.guildId = messageReaction.message.guild?.id || '';
        sbQuote.messageId = messageReaction.message.id;
        const savedQuote = await quoteRepo.save(sbQuote, { reload: true });
        const quotedMember = await this.sb.getMember(savedQuote.guildId, savedQuote.user.discordUserId);
        if (quotedMember) {
          await messageReaction.message.channel.send({
            content: `I've noted that ${quotedMember.displayName} said: "${savedQuote.quoteText}"`,
          });
        }
      }
    }
  }
}
