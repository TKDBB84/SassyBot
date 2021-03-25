import { Message, MessageEmbed } from 'discord.js';
import { UserIds } from '../../consts';
import { ISassybotCommandParams, XIVAPISearchResponse } from '../../Sassybot';
import SassybotCommand from './SassybotCommand';
// @ts-ignore
import * as XIVApi from '@xivapi/js';

export default class EmbedCommand extends SassybotCommand {
  public readonly commands = ['embed'];

  public getHelpText(): string {
    return 'blahblahblah';
  }

  protected async listener({message, params}: { message: Message; params: ISassybotCommandParams }): Promise<void> {
    if (message.author.id !== UserIds.SASNER) {
      return
    }
    const xiv = new XIVApi({ private_key: process.env.XIV_API_TOKEN, language: 'en' });
    const declaredName = 'sasner rensas'
    const {Results}: XIVAPISearchResponse = await xiv.character.search(declaredName, {server: 'Jenova'})
    const apiChars = Results.filter(result => result.Name.trim().toLowerCase() === declaredName.toLowerCase())
    if (apiChars.length === 1) {
      const apiCharacter = apiChars[0]
      const embed = new MessageEmbed({
        title: 'This You?',
        description: 'Is this your character?',
        image: {url: apiCharacter.Avatar},
        footer: {
          text: 'Yes/No'
        }
      })
      await message.reply(embed)
    }
  }
}
