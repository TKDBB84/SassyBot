import { Message } from 'discord.js';
import SassybotEventListener from './SassybotEventListener';
import { GuildIds, UserIds } from '../consts';
import { Sassybot } from '../Sassybot';

export default class GamezzEyeListenerListener extends SassybotEventListener {
  constructor(sb: Sassybot) {
    super(sb, 'messageReceived');
  }

  public getEventListener(): ({ message }: { message: Message }) => Promise<void> {
    return this.listener.bind(this);
  }

  protected async listener({ message }: { message: Message }): Promise<void> {
    if (
      message.cleanContent.toLowerCase().startsWith('!sb ') ||
      message.cleanContent.toLowerCase().startsWith('!sassybot ') ||
      !message.member ||
      !message.guild ||
      message.guild.id !== GuildIds.GAMEZZZ_GUILD_ID ||
      !message.channel.isSendable()
    ) {
      return;
    }
    if (message.author.id === UserIds.SASNER) {
      return;
    }

    let outMessage = '';
    const leftEyesExp = /.*<(\s*.\s*)<.*/;
    const rightEyesExp = /.*>(\s*.\s*)>.*/;

    const messageLeft = leftEyesExp.exec(message.content);
    const messageRight = rightEyesExp.exec(message.content);
    let leftResponse = '';
    let leftEyes = '';
    let rightResponse = '';
    let rightEyes = '';
    if (messageLeft) {
      leftEyes = `<${messageLeft[1]}<`;
      leftResponse = `>${messageLeft[1]}>`;
    }
    if (messageRight) {
      rightEyes = `>${messageRight[1]}>`;
      rightResponse = `<${messageRight[1]}<`;
    }

    if (messageLeft && messageRight) {
      if (message.content.indexOf(leftEyes) < message.content.indexOf(rightEyes)) {
        outMessage = `${leftResponse} ${rightResponse}`;
      } else {
        outMessage = `${rightResponse} ${leftResponse}`;
      }
    } else if (messageLeft) {
      outMessage = leftResponse;
    } else if (messageRight) {
      outMessage = rightResponse;
    }

    if (outMessage === '') {
      const authorNickname = message.member.nickname ? message.member.nickname : message.author.username;
      const authorLeft = leftEyesExp.exec(authorNickname);
      const authorRight = rightEyesExp.exec(authorNickname);
      if (authorLeft) {
        outMessage = `>${authorLeft[1]}> (but only because you named yourself that)`;
      } else if (authorRight) {
        outMessage = `<${authorRight[1]}< (but only because you named yourself that)`;
      }
    }

    if (outMessage !== '' && Math.random() >= 0.25) {
      await message.channel.send(outMessage);
    }
  }
}
