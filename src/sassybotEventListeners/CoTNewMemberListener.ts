import { GuildMember, Message, MessageCollector, TextChannel } from 'discord.js';
import { CotRanks, CoTRankValueToString, GuildIds, NewUserChannels } from '../consts';
import COTMember from '../entity/COTMember';
import FFXIVChar from '../entity/FFXIVChar';
import SassybotEventListener from './SassybotEventListener';
import SbUser from '../entity/SbUser';

export default class CoTNewMemberListener extends SassybotEventListener {
  private static async requestRuleAgreement(message: Message) {
    await message.channel.send(
      'This is a quick verification process requiring you to read through our rules and become familiar with the rank guidelines for promotions/absences. \n\n' +
        'Once you\'ve done that, please type "I Agree" and you\'ll be granted full access to the server! We hope you enjoy your stay 😃',
      { split: true, reply: message.author },
    );
  }

  private async couldNotRemoveRole(message: Message, role: any, error: any) {
    this.sb.logger.warn('could not remove role', { role, error });
    await message.channel.send(
      "Sorry I'm a terrible bot, I wasn't able to remove your 'New' status, please contact @Sasner#1337 for help.",
      { reply: message.author },
    );
  }
  private async couldNotAddRole(message: Message, role: any, error: any) {
    this.sb.logger.warn('could not add role', { role, error });
    await message.channel.send(
      `Sorry I'm a terrible bot, I wasn't able to add your Proper Rank, please contact @Sasner#1337 for help.`,
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
      const knownRank = isCotMember.rank;
      const role = await this.sb.getRole(GuildIds.COT_GUILD_ID, knownRank);
      if (role) {
        await member.roles.add(role, 'Added Known Rank To User');
        if (isCotMember.character.name && (knownRank === CotRanks.MEMBER || knownRank === CotRanks.RECRUIT)) {
          await member.setNickname(isCotMember.character.name.trim(), 'Set To Match Char Name');
        }
      }
      return;
    }

    const newMemberChannel = (await this.sb.getChannel(NewUserChannels[GuildIds.COT_GUILD_ID])) as TextChannel;
    if (!newMemberChannel) {
      this.sb.logger.warn('unable to fetch new user channel', { channel: NewUserChannels[GuildIds.COT_GUILD_ID] });
      return;
    }

    const newRole = await this.sb.getRole(GuildIds.COT_GUILD_ID, CotRanks.NEW);
    if (newRole) {
      await member.roles.add(newRole, 'User Joined Server');
    } else {
      this.sb.logger.warn(`Unable to find CoT New Rank`, { newRole });
      return;
    }

    const sbUser = await SbUser.findOrCreateUser(member.id);
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
          await this.declaringCharacterName(message, sbUser);
          await CoTNewMemberListener.requestRuleAgreement(message);
          break;
        case 1:
          const agreed = await this.acceptingTerms(message);
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

  private async declaringCharacterName(message: Message, sbUser: SbUser) {
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

    const ffXivChar = await FFXIVChar.findOrCreateCharacter(declaredName.toLowerCase(), sbUser);
    if (nameMatch) {
      // found in API before
      const cotMember = await COTMember.findOrCreateCotMember(ffXivChar);
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

  private async acceptingTerms(message: Message): Promise<boolean> {
    if (!message.guild || !message.member) {
      return false;
    }
    const [newRole, guestRole] = await Promise.all([
      this.sb.getRole(GuildIds.COT_GUILD_ID, CotRanks.NEW),
      this.sb.getRole(GuildIds.COT_GUILD_ID, CotRanks.GUEST),
    ]);

    const messageContent = message.cleanContent
      .replace(/[^a-z-A-Z ]/g, '')
      .replace(/ +/, ' ')
      .trim()
      .toLowerCase();

    if (messageContent === 'i agree') {
      const ffXivChar = await this.sb.dbConnection
        .getRepository<FFXIVChar>(FFXIVChar)
        .findOneOrFail({ user: { discordUserId: message.author.id } });
      const cotMember = await this.sb.dbConnection
        .getRepository<COTMember>(COTMember)
        .findOne({ character: { id: ffXivChar.id } });
      if (cotMember) {
        cotMember.firstSeenDiscord = new Date();
        if (newRole) {
          try {
            await message.member.roles.remove(newRole, 'agreed to rules');
          } catch (e) {
            await this.couldNotRemoveRole(message, newRole, e);
            return true;
          }
        } else {
          await this.couldNotRemoveRole(message, 'new role', 'unable to get role from client');
          return true;
        }
        const roleToAdd = await this.sb.getRole(GuildIds.COT_GUILD_ID, cotMember.rank);
        if (roleToAdd) {
          try {
            await message.member.roles.add(roleToAdd, 'added best-guess rank');
          } catch (e) {
            await this.couldNotAddRole(message, roleToAdd, e);
            return true;
          }
        } else {
          await this.couldNotAddRole(message, CoTRankValueToString[cotMember.rank], 'unable to get role from client');
          return true;
        }
      } else {
        if (newRole) {
          try {
            await message.member.roles.remove(newRole, 'agreed to rules');
          } catch (e) {
            await this.couldNotRemoveRole(message, newRole, e);
            return true;
          }
        } else {
          await this.couldNotRemoveRole(message, 'new role', 'unable to get role from client');
          return true;
        }
        if (guestRole) {
          try {
            await message.member.roles.add(guestRole, 'User not found in COT from API');
          } catch (e) {
            await this.couldNotAddRole(message, guestRole, e);
            return true;
          }
        } else {
          await this.couldNotAddRole(message, 'Guest', 'unable to get role from client');
          return true;
        }
      }
      await message.channel.send('Thank You & Welcome to Crowne Of Thorne', { reply: message.author });
      return true;
    }
    return false;
  }
}
