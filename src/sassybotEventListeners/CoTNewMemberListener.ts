import { GuildMember, Message, MessageCollector, Snowflake, TextChannel } from 'discord.js';
import { CotRanks, CoTRankValueToString, GuildIds, NewUserChannels, UserIds } from '../consts';
import COTMember from '../entity/COTMember';
import FFXIVChar from '../entity/FFXIVChar';
import SbUser from '../entity/SbUser';
import SassybotEventListener from './SassybotEventListener';

export default class CoTNewMemberListener extends SassybotEventListener {
  private static async requestRuleAgreement(message: Message) {
    message.channel.send(
      'This is a quick verification process requiring you to read through our rules and become familiar with the rank guidelines for promotions/absences. \n\n' +
        'Once you\'ve done that, please type "I Agree" and you\'ll be granted full access to the server! We hope you enjoy your stay 😃',
      { split: true, reply: message.author },
    );
  }

  private static async couldNotRemoveRole(message: Message, role: any, error: any) {
    console.error('could not remove role', { role, error });
    await message.channel.send(
      "Sorry I'm a terrible bot, I wasn't able to remove your 'New' status, please contact @Sasner#1337 or @Zed#8495 for help.",
      { reply: message.author },
    );
  }
  private static async couldNotAddRole(message: Message, role: any, error: any) {
    console.error('could not add role', { role, error });
    await message.channel.send(
      `Sorry I'm a terrible bot, I wasn't able to add your Proper Rank, please contact @Sasner#1337 or @Zed#8495 for help.`,
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

    const isCotMember = await this.findCoTMemberByDiscordId(member.id);
    if (isCotMember && isCotMember.firstSeenDiscord) {
      const knownRank = isCotMember.rank;
      const role = await this.sb.getRole(GuildIds.COT_GUILD_ID, knownRank);
      if (role) {
        await member.addRole(role, 'Added Known Rank To User');
        if (isCotMember.character.name && (knownRank === CotRanks.MEMBER || knownRank === CotRanks.RECRUIT)) {
          await member.setNickname(isCotMember.character.name.trim(), 'Set To Match Char Name');
        }
      }
      return;
    }

    let dmSasner = {
      send: console.log,
    };

    try {
      const sasner = await this.sb.getUser(UserIds.SASNER);
      if (sasner) {
        dmSasner = await sasner.createDM();
      } else {
        console.error('unable to find "New" Rank, unable to communicate with Sasner');
      }
    } catch (e) {
      console.error('unable to find "New" Rank, unable to communicate with Sasner', { e });
    }

    const newMemberChannel = (await this.sb.getChannel(NewUserChannels[GuildIds.COT_GUILD_ID])) as TextChannel;
    if (!newMemberChannel) {
      dmSasner.send('unable to fetch new user channel');
      return;
    }

    const newRole = await this.sb.getRole(GuildIds.COT_GUILD_ID, CotRanks.NEW);
    if (newRole) {
      await member.addRole(newRole, 'User Joined Server');
    } else {
      dmSasner.send(`Unable to find CoT New Rank ${JSON.stringify(newRole)}`);
      return;
    }

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

  protected async findCoTMemberByDiscordId(discordId: Snowflake): Promise<COTMember | false> {
    const sbUserRepo = this.sb.dbConnection.getRepository(SbUser);
    let sbUser = await sbUserRepo.findOne(discordId);
    if (!sbUser) {
      sbUser = new SbUser();
      sbUser.discordUserId = discordId;
      await sbUserRepo.save(sbUser);
      return false;
    }
    const char = await this.sb.dbConnection
      .getRepository(FFXIVChar)
      .findOne({ where: { user: { discordUserId: sbUser.discordUserId } } });
    if (!char) {
      return false;
    }

    const member = await this.sb.dbConnection
      .getRepository(COTMember)
      .findOne({ where: { character: { id: char.id } } });
    char.user = sbUser;
    if (member) {
      member.character = char;
      return member;
    }
    return false;
  }

  private async declaringCharacterName(message: Message) {
    const declaredName = message.cleanContent.trim();
    if (message.member && message.member.nickname) {
      if (message.member.nickname.trim() === declaredName) {
        return;
      }
    }
    await message.member.setNickname(declaredName, 'Declared Character Name').catch(async (e) => {
      await message.channel.send(
        'I was unable to update your discord nickname to match your character name, would you please do that when you have a few minutes?',
        { reply: message.author },
      );
      console.error('unable to update nickname', { e });
    });
    const nameMatch = await this.sb.dbConnection
      .getRepository(FFXIVChar)
      .createQueryBuilder()
      .where(`LOWER(name) = LOWER(:name)`, { name: declaredName.toLowerCase() })
      .getOne();

    if (nameMatch) {
      // found in API before
      const cotMember = await COTMember.getCotMemberByName(nameMatch.name, message.author.id, CotRanks.NEW);
      if (cotMember.rank !== CotRanks.NEW) {
        await message.channel.send(
          `I've found your FC membership, it looks like you're currently a: ${
            CoTRankValueToString[cotMember.rank]
          }, i'll be sure to set that for you when we're done.`,
          { split: true },
        );
      }
    }
  }

  private async acceptingTerms(declaredName: string, message: Message): Promise<boolean> {
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

      if (nameMatch) {
        const cotMember = await COTMember.getCotMemberByName(nameMatch.name, message.author.id);
        cotMember.firstSeenDiscord = new Date();
        if (cotMember.rank === CotRanks.NEW) {
          await cotMember.promote();
        }
        const newRole = await this.sb.getRole(GuildIds.COT_GUILD_ID, CotRanks.NEW);
        if (newRole) {
          try {
            await message.member.removeRole(newRole);
          } catch (e) {
            await CoTNewMemberListener.couldNotRemoveRole(message, newRole, e);
            return true;
          }
        } else {
          await CoTNewMemberListener.couldNotRemoveRole(message, 'new role', 'unable to get role from client');
          return true;
        }
        const roleToAdd = await this.sb.getRole(GuildIds.COT_GUILD_ID, cotMember.rank);
        if (roleToAdd) {
          try {
            await message.member.addRole(roleToAdd);
          } catch (e) {
            await CoTNewMemberListener.couldNotAddRole(message, roleToAdd, e);
            return true;
          }
        } else {
          await CoTNewMemberListener.couldNotAddRole(
            message,
            CoTRankValueToString[cotMember.rank],
            'unable to get role from client',
          );
          return true;
        }
      } else {
        const guest = await this.sb.getRole(GuildIds.COT_GUILD_ID, CotRanks.GUEST);
        if (guest) {
          try {
            await message.member.addRole(guest, 'User not found in COT from API');
          } catch (e) {
            await CoTNewMemberListener.couldNotAddRole(message, guest, e);
            return true;
          }
        } else {
          await CoTNewMemberListener.couldNotAddRole(message, 'Guest', 'unable to get role from client');
          return true;
        }
      }
      await message.channel.send('Thank You & Welcome to Crowne Of Thorne', { reply: message.author });
      return true;
    }
    return false;
  }
}
