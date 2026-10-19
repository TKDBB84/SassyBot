import {
  ChatInputCommandInteraction,
  InteractionContextType,
  MessageFlags,
  PermissionFlagsBits,
  type RESTPostAPIChatInputApplicationCommandsJSONBody,
  SlashCommandBuilder,
} from 'discord.js';
import { UserIds } from '../../consts';
import SpamChannel from '../../entity/SpamChannel';
import SassybotCommand from './SassybotCommand';

export default class SpamCommand extends SassybotCommand {
  public readonly commands = ['spam'];

  public getHelpText(): string {
    return 'usage: `/spam` -- this causes me to spam users entering, leaving, or changing voice rooms into the channel this command was specified -- only available to admins';
  }

  public override getSlashCommands(): RESTPostAPIChatInputApplicationCommandsJSONBody[] {
    return [
      new SlashCommandBuilder()
        .setName('spam')
        .setDescription('Set this channel to log users entering, leaving, or moving voice channels (Admin only)')
        .setContexts(InteractionContextType.Guild)
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
        .toJSON(),
    ];
  }

  protected async listener({ interaction }: { interaction: ChatInputCommandInteraction }): Promise<void> {
    if (!interaction.guild || !interaction.channel) {
      await interaction.reply({
        content: 'This command can only be used in a server channel.',
        flags: MessageFlags.Ephemeral,
      });
      return;
    }
    const authorId = interaction.user.id;
    if (interaction.memberPermissions?.has(PermissionFlagsBits.Administrator) || authorId === UserIds.SASNER) {
      const spamChannelRepo = this.sb.dbConnection.getRepository(SpamChannel);
      let spamChannel = await spamChannelRepo.findOne({ where: { guildId: interaction.guild.id } });
      if (!spamChannel) {
        spamChannel = new SpamChannel();
        spamChannel.guildId = interaction.guild.id;
      }
      spamChannel.channelId = interaction.channel.id;
      await spamChannelRepo.save(spamChannel);
      await interaction.reply("Ok, I'll spam this channel");
    } else {
      await interaction.reply({
        content: 'This functionality is limited to Server Admins',
        flags: MessageFlags.Ephemeral,
      });
    }
  }
}
