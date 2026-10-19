import { UserIds } from '../../../consts';
import { ChatInputCommandInteraction, Message } from 'discord.js';

const isMessageFromAdmin = (messageOrInteraction: Message | ChatInputCommandInteraction): boolean => {
  const userId = 'author' in messageOrInteraction ? messageOrInteraction.author.id : messageOrInteraction.user.id;
  return userId.toString() === UserIds.SASNER.toString();
};

export default isMessageFromAdmin;
