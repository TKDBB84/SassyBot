import { Message, MessageCollector, MessageEmbed } from 'discord.js';
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

  protected async listener({ message, params }: { message: Message; params: ISassybotCommandParams }): Promise<void> {
    if (message.author.id !== UserIds.SASNER) {
      return;
    }
    if (!this.sb.isTextChannel(message.channel)) {
      return;
    }

    const xiv = new XIVApi({ private_key: process.env.XIV_API_TOKEN, language: 'en' });
    const declaredName = 'sasner rensas';
    const { Results }: XIVAPISearchResponse = await xiv.character.search(declaredName, { server: 'Jenova' });
    const apiChars = Results; // .filter((result) => result.Name.trim().toLowerCase() === declaredName.toLowerCase());
    if (apiChars.length === 0) {
      // couldn't find the character, just giong to accept the name and move on
    } else if (apiChars.length === 1) {
      const apiCharacter = apiChars[0];
      const embed = new MessageEmbed({
        title: 'Is this your character?',
        description: 'You can type "Yes" or "No"',
        image: { url: apiCharacter.Avatar },
        footer: {
          text: apiCharacter.Name,
        },
      });
      await message.reply(embed);
    } else {
      // many characters match, going to have to get them to tell me which one:
      await message.reply('Multiple Characters match your name, please choose which character is yours');
      const filter = (collectedMessage: Message) => {
        if (collectedMessage.author.id !== message.author.id) {
          return false;
        }
        const collectedValue = parseInt(collectedMessage.cleanContent.replace(/\D/g, ''), 10);
        return !(collectedValue <= 0 || collectedValue > apiChars.length);
      };
      let collector: MessageCollector;
      for (let i = 0; i < apiChars.length; i++) {
        const apiCharacter = apiChars[i];
        const embed = new MessageEmbed({
          title: apiCharacter.Name,
          description: `You can type "${i + 1}" to select this character`,
          image: { url: apiCharacter.Avatar },
          footer: {
            text: apiCharacter.Rank || '',
          },
        });
        await message.reply(embed);
        if (i === 0) {
          collector = new MessageCollector(message.channel, filter, { max: 1 });
        }
      }
      collector!.on('end', (collected) => {
        if (collected.size > 0) {
          const collectedMessage = collected.first();
          if (collectedMessage) {
            const chosenInt = parseInt(collectedMessage.cleanContent.replace(/\D/g, ''), 10) - 1;
            const chosenCharacter = apiChars[chosenInt];
            const embed = new MessageEmbed({
              title: 'You picked',
              description: `this one`,
              image: { url: chosenCharacter.Avatar },
              footer: {
                text: apiChars[chosenInt].Rank || '',
              },
            });
            message.reply(embed);
          }
        }
      });
    }
  }
}
