import { GuildMember, Message, MessageCollector, TextChannel } from 'discord.js';
import { CotRanks, CoTRankValueToString, GuildIds, NewUserChannels, UserIds } from '../consts';
import COTMember from '../entity/COTMember';
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
    const cotMemberRepo = this.sb.dbConnection.getRepository(COTMember);
    const isCotMember = await cotMemberRepo.findOne({
      where: { player: { user: { discordUserId: member.id } } },
    });
    if (isCotMember) {
      const knownRank = isCotMember.rank;
      const role = await this.sb.getRole(GuildIds.COT_GUILD_ID, knownRank);
      if (role) {
        await member.addRole(role, 'Added Known Rank To User');
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
      dmSasner.send('Unable to find CoT New Rank');
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
    const cotMember = await COTMember.getCotMemberByName(declaredName, message.author.id);
    if (cotMember.rank !== CotRanks.NEW) {
      // found in API before
      message.channel.send(
        `I've found your FC membership, it looks like you're currently a: ${
          CoTRankValueToString[cotMember.rank]
        }, i'll be sure to set that for you when we're done.`,
        { split: true },
      );
    }
  }

  private async acceptingTerms(declaredName: string, message: Message): Promise<boolean> {
    const messageContent = message.cleanContent
      .replace('"', '')
      .replace("'", '')
      .trim()
      .toLowerCase();
    if (messageContent === 'i agree') {
      const cotMember = await COTMember.getCotMemberByName(declaredName, message.author.id);
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
      await message.channel.send('Thank You & Welcome to Crowne Of Thorne', { reply: message.author });
      return true;
    }
    return false;
  }
}
