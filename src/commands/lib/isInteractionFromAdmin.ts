import { UserIds } from '../../consts';
import { Interaction } from 'discord.js';

const isInteractionFromAdmin = (interaction: Interaction): boolean => {
  return interaction.user.id.toString() === UserIds.SASNER.toString();
};

export default isInteractionFromAdmin;
