// disabled for external fetch
import {
  ChatInputCommandInteraction,
  type RESTPostAPIChatInputApplicationCommandsJSONBody,
  SlashCommandBuilder,
} from 'discord.js';
import SassybotCommand from './SassybotCommand';
import fetch from 'node-fetch';

interface JokeApiResponse {
  error?: boolean;
  type?: 'single' | 'twopart';
  joke?: string;
  setup?: string;
  delivery?: string;
}

export default class PunCommand extends SassybotCommand {
  public getHelpText(): string {
    return 'usage: `/pun` or `/joke` -- I send a stupid pun or joke to the channel';
  }

  public override getSlashCommands(): RESTPostAPIChatInputApplicationCommandsJSONBody[] {
    return [
      new SlashCommandBuilder().setName('pun').setDescription('I send a stupid pun to the channel').toJSON(),
      new SlashCommandBuilder().setName('joke').setDescription('I send a joke to the channel').toJSON(),
    ];
  }

  protected async listener({ interaction }: { interaction: ChatInputCommandInteraction }): Promise<void> {
    await interaction.deferReply();
    let url = 'https://v2.jokeapi.dev/joke';
    const command = interaction.commandName.toLowerCase();
    if (command === 'pun') {
      url += '/Pun';
    } else {
      url += '/Any';
    }
    url += '?type=twopart';
    const jokeRes = await fetch(url);
    if (!jokeRes.ok) {
      await interaction.editReply('Sorry, I could not fetch a joke right now.');
      return;
    }
    const data = (await jokeRes.json()) as JokeApiResponse;
    if (data.error || (!data.setup && !data.joke)) {
      await interaction.editReply('Sorry, I could not find a joke right now.');
      return;
    }
    const text = data.setup && data.delivery ? `${data.setup}\n\n||${data.delivery}||` : (data.joke ?? '');
    await interaction.editReply(text);
  }
}
