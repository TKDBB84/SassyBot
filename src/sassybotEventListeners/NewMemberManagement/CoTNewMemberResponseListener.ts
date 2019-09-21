import { Message } from 'discord.js';
import { CotRanks, CoTRankValueToString, GuildIds } from '../../consts';
import COTMember from '../../entity/COTMember';
import FFXIVPlayer from '../../entity/FFXIVPlayer';
import SbUser from '../../entity/SbUser';
import SassybotEventListener from '../SassybotEventListener';

interface IActiveMemberList {
  [userId: string]: {
    name: string;
    joined: Date;
    step: number;
  };
}

export default class CoTNewMemberResponseListener extends SassybotEventListener {

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
  public activeMemberList: IActiveMemberList = {};
  protected readonly event = 'messageReceived';
  protected readonly onEvent = this.listener;

  protected async listener({ message }: { message: Message }): Promise<void> {
    if (this.activeMemberList.hasOwnProperty(message.author.id)) {
      const currentStep = this.activeMemberList[message.author.id].step;
      switch (currentStep) {
        case 1:
          await this.declaringCharacterName(message);
          await CoTNewMemberResponseListener.requestRuleAgreement(message);
          this.activeMemberList[message.author.id].step = 2;
          break;
        case 2:
          await this.acceptingTerms(message);
          delete this.activeMemberList[message.author.id];
          break;
      }
    }
  }

  private async getCotMemberByName(charName: string, discordUserId: string): Promise<COTMember> {
    const cotMemberRepo = this.sb.dbConnection.getRepository(COTMember);
    let cotMember = await cotMemberRepo
      .createQueryBuilder()
      .where('LOWER(charName) = :charName', { charName })
      .getOne();
    if (!cotMember) {
      const sbUserRepo = this.sb.dbConnection.getRepository(SbUser);
      const sbUser = new SbUser();
      sbUser.discordUserId = discordUserId;
      await sbUserRepo.save(sbUser);

      const cotPlayerRepo = this.sb.dbConnection.getRepository(FFXIVPlayer);
      const cotPlayer = new FFXIVPlayer();
      cotPlayer.user = sbUser;
      cotPlayer.charName = charName;
      await cotPlayerRepo.save(cotPlayer);

      cotMember = new COTMember();
      cotMember.player = cotPlayer;
      cotMember.rank = CotRanks.NEW;
      cotMember.firstSeenDiscord = new Date();
    }

    cotMember.discordUserId = discordUserId;
    await cotMemberRepo.save(cotMember);
    return cotMember;
  }

  private async declaringCharacterName(message: Message) {
    const declaredName = message.cleanContent;
    await message.member.setNickname(declaredName, 'Declared Character Name').catch(async (e) => {
      await message.channel.send(
        'I was unable to update your discord nickname to match your character name, would you please do that when you have a few minutes?',
        { reply: message.author },
      );
      console.error('unable to update nickname', { e });
    });
    const cotMember = await this.getCotMemberByName(declaredName, message.author.id);
    if (cotMember.rank !== CotRanks.NEW) {
      // found in API before
      message.channel.send(
        `I've found your FC membership, it looks like you're currently a: ${
          CoTRankValueToString[cotMember.rank]
        }, i'll be sure to set that for you when we're done.`,
        { split: true },
      );
    }
    this.activeMemberList[message.author.id].name = declaredName;
  }

  private async acceptingTerms(message: Message) {
    if (message.cleanContent.trim().toLowerCase() === 'i agree') {
      const declaredName = this.activeMemberList[message.author.id].name;
      const cotMember = await this.getCotMemberByName(declaredName, message.author.id);
      if (cotMember.rank === CotRanks.NEW) {
        await cotMember.promote();
      }
      const newRole = await this.sb.getRole(GuildIds.COT_GUILD_ID, CotRanks.NEW);
      if (newRole) {
        try {
          await message.member.removeRole(newRole);
        } catch (e) {
          await CoTNewMemberResponseListener.couldNotRemoveRole(message, newRole, e);
          return;
        }
      } else {
        await CoTNewMemberResponseListener.couldNotRemoveRole(message, 'new role', 'unable to get role from client');
        return;
      }
      const roleToAdd = await this.sb.getRole(GuildIds.COT_GUILD_ID, cotMember.rank);
      if (roleToAdd) {
        try {
          await message.member.addRole(roleToAdd);
        } catch (e) {
          await CoTNewMemberResponseListener.couldNotAddRole(message, roleToAdd, e);
          return;
        }
      } else {
        await CoTNewMemberResponseListener.couldNotAddRole(
          message,
          CoTRankValueToString[cotMember.rank],
          'unable to get role from client',
        );
        return;
      }
      await message.channel.send('Thank You & Welcome to Crowne Of Thorne', { reply: message.author });
    }
  }
}
