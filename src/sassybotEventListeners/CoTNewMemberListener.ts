import { GuildMember, Message, MessageCollector } from 'discord.js';
import { CotRanks, CoTRankValueToString, GuildIds, NewUserChannels } from '../consts';
import COTMember from '../entity/COTMember';
import FFXIVChar from '../entity/FFXIVChar';
import SassybotEventListener from './SassybotEventListener';

export default class CoTNewMemberListener extends SassybotEventListener {
  private static async requestRuleAgreement(message: Message) {
    await message.channel.send(
      'This is a quick verification process requiring you to read through our rules and become familiar with the rank guidelines for promotions/absences. \n\n' +
        'Once you\'ve done that, please type "I Agree" and you\'ll be granted full access to the server! We hope you enjoy your stay 😃',
      { split: true, reply: message.author },
    );
  }

  private async couldNotRemoveRole(message: Message, role: any, error: any) {
    const sasner = await this.sb.getSasner();
    this.sb.logger.warn('could not remove role', { role, error });
    await message.channel.send(
      `Sorry I'm a terrible bot, I wasn't able to remove your 'New' status, please contact ${sasner} for help.`,
      { reply: message.author },
    );
  }

  public readonly event = 'guildMemberAdd';
  public getEventListener() {
    return this.listener.bind(this);
  }

  protected async listener({ member }: { member: GuildMember }): Promise<void> {
    if (member.guild.id !== GuildIds.COT_GUILD_ID) {
      return;
    }

    const isCotMember = await this.sb.findCoTMemberByDiscordId(member.id);
    if (isCotMember && isCotMember.firstSeenDiscord) {
      const role = isCotMember.rank;
      await member.roles.add(role, 'Added Known Rank To User');
      if (isCotMember.character.name && (role === CotRanks.MEMBER || role === CotRanks.RECRUIT)) {
        await member.setNickname(isCotMember.character.name.trim(), 'Set To Match Char Name');
      }
      return;
    }

    const newMemberChannel = await this.sb.getChannel(NewUserChannels[GuildIds.COT_GUILD_ID]);
    if (!newMemberChannel || !this.sb.isTextChannel(newMemberChannel)) {
      this.sb.logger.warn('unable to fetch new user channel', { channel: NewUserChannels[GuildIds.COT_GUILD_ID] });
      return;
    }

    await member.roles.add(CotRanks.NEW, 'User Joined Server');

    await newMemberChannel.send(
      'Hey, welcome to the Crowne of Thorne server!\n\nFirst Can you please type your FULL FFXIV character name?',
      {
        reply: member,
      },
    );
    const messageFilter = (message: Message) => {
      return message.author.id === member.user.id && message.cleanContent.trim().length > 0;
    };
    const messageCollector = new MessageCollector(newMemberChannel, messageFilter);
    let messageCount = 0;
    let declaredName = '';
    messageCollector.on('collect', async (message) => {
      switch (messageCount) {
        case 0:
          declaredName = message.cleanContent;
          await this.declaringCharacterName(message);
          await CoTNewMemberListener.requestRuleAgreement(message);
          break;
        case 1:
          const agreed = await this.acceptingTerms(declaredName, message);
          if (agreed) {
            messageCollector.stop();
          } else {
            messageCount = 0;
          }
          break;
      }
      messageCount++;
    });
  }

  private async declaringCharacterName(message: Message) {
    if (!message.guild || !message.member) {
      return;
    }
    const declaredName = message.cleanContent.trim();
    if (message.member && message.member.nickname) {
      if (message.member.nickname.trim() === declaredName) {
        return;
      }
    }
    await message.member.setNickname(declaredName, 'Declared Character Name').catch(async (error) => {
      await message.channel.send(
        'I was unable to update your discord nickname to match your character name, would you please do that when you have a few minutes?',
        { reply: message.author },
      );
      this.sb.logger.warn('unable to update nickname', { error });
    });
    const nameMatch = await this.sb.dbConnection
      .getRepository(FFXIVChar)
      .createQueryBuilder()
      .where(`LOWER(name) = LOWER(:name)`, { name: declaredName.toLowerCase() })
      .getOne();

    if (nameMatch) {
      // found in API before
      const cotMember = await COTMember.getCotMemberByName(nameMatch.name, message.author.id);
      if (cotMember.rank !== CotRanks.NEW) {
        await message.channel.send(
          `I've found your FC membership, it looks like you're currently a ${
            CoTRankValueToString[cotMember.rank]
          }, I'll be sure to set that for you when we're done.`,
          { split: true },
        );
      }
    }
  }

  private async acceptingTerms(declaredName: string, message: Message): Promise<boolean> {
    if (!message.guild || !message.member) {
      return false;
    }

    const messageContent = message.cleanContent
      .replace(/[^a-z-A-Z ]/g, '')
      .replace(/ +/, ' ')
      .trim()
      .toLowerCase();
    if (messageContent === 'i agree') {
      const nameMatch = await this.sb.dbConnection
        .getRepository(FFXIVChar)
        .createQueryBuilder()
        .where(`LOWER(name) = LOWER(:name)`, { name: declaredName.toLowerCase() })
        .getOne();

      let roleToAdd = CotRanks.GUEST;
      if (nameMatch) {
        const cotMember = await COTMember.getCotMemberByName(nameMatch.name, message.author.id);
        roleToAdd = cotMember.rank === CotRanks.NEW ? CotRanks.GUEST : cotMember.rank;
      }
      try {
        await Promise.all([
          message.member.roles.remove(CotRanks.NEW, 'agreed to rules'),
          message.member.roles.add(roleToAdd, nameMatch ? 'added best-guess rank' : 'User not found in COT from API'),
        ]);
      } catch (e) {
        await this.couldNotRemoveRole(message, CotRanks.NEW, e);
        return true;
      }
      await message.channel.send('Thank You & Welcome to Crowne Of Thorne', { reply: message.author });
      return true;
    }
    return false;
  }
}
