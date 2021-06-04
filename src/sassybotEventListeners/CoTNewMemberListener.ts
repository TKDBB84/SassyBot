import { GuildMember, Message, TextChannel } from 'discord.js';
import { CotRanks, CoTRankValueToString, GuildIds, NewUserChannels } from '../consts';
import COTMember from '../entity/COTMember';
import FFXIVChar from '../entity/FFXIVChar';
import SassybotEventListener from './SassybotEventListener';

export default class CoTNewMemberListener extends SassybotEventListener {
  private static messageFilter = (member: GuildMember) => (message: Message) => {
    return message.author.id === member.user.id && message.cleanContent.trim().length > 0;
  };

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

    const declaredName = await this.getDeclaredName(newMemberChannel, member);
    await this.getAgreement(newMemberChannel, member, declaredName);
  }

  private async getDeclaredName(newMemberChannel: TextChannel, member: GuildMember): Promise<string> {
    await newMemberChannel.send(
      'Hey, welcome to the Crowne of Thorne server!\n\nFirst Can you please type your FULL FFXIV character name?',
      { reply: member },
    );
    const collectedNameMessages = await newMemberChannel.awaitMessages(CoTNewMemberListener.messageFilter(member), {
      max: 1,
    });
    const declaredName = collectedNameMessages.first();
    return this.declaringCharacterName(declaredName!);
  }
  private async declaringCharacterName(message: Message): Promise<string> {
    if (!message.guild || !message.member) {
      return '';
    }
    const declaredName = message.cleanContent.trim();
    const memberName = message.member.nickname || message.author.username;
    const nameMatchesNickName = memberName.trim() === declaredName;
    if (!nameMatchesNickName) {
      try {
        await message.member.setNickname(declaredName, 'Declared Character Name');
      } catch (error) {
        await message.channel.send(
          'I was unable to update your discord nickname to match your character name, would you please do that when you have a few minutes?',
          { reply: message.author },
        );
        this.sb.logger.warn('unable to update nickname', { error });
      }
    }
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
        );
      }
    }
    return declaredName;
  }

  private async getAgreement(
    newMemberChannel: TextChannel,
    member: GuildMember,
    declaredName: string,
    firstRun: boolean = true,
  ): Promise<void> {
    if (firstRun) {
      await newMemberChannel.send(
        'This is a quick verification process requiring you to read through our rules and become familiar with the rank guidelines for promotions/absences. \n\n' +
          'Once you\'ve done that, please type "I Agree" and you\'ll be granted full access to the server! We hope you enjoy your stay 😃',
        { reply: member },
      );
    } else {
      await newMemberChannel.send(
        'Sorry, you must agree to the rules to processed, please type "I Agree" to access the server',
        { reply: member },
      );
    }
    const collectedNameMessages = await newMemberChannel.awaitMessages(CoTNewMemberListener.messageFilter(member), {
      max: 1,
    });

    const agreed = await this.acceptingTerms(declaredName, collectedNameMessages.first());
    if (agreed) {
      return;
    }
    return await this.getAgreement(newMemberChannel, member, declaredName, false);
  }
  private async acceptingTerms(declaredName: string, message: Message | undefined): Promise<boolean> {
    if (!message || !message.guild || !message.member) {
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
        const sasner = await this.sb.getSasner();
        this.sb.logger.warn('could not remove role', { rank: CotRanks.NEW, error: e });
        await message.channel.send(
          `Sorry I'm a terrible bot, I wasn't able to remove your 'New' status, please contact ${sasner} for help.`,
          { reply: message.author },
        );
        return true;
      }
      await message.channel.send('Thank You & Welcome to Crowne Of Thorne', { reply: message.author });
      return true;
    }
    return false;
  }
}
