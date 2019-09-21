import { GuildMember, TextChannel } from 'discord.js';
import { CotRanks, GuildIds, NewUserChannels, UserIds } from '../../consts';
import COTMember from '../../entity/COTMember';
import { Sassybot } from '../../Sassybot';
import SassybotEventListener from '../SassybotEventListener';
import CoTNewMemberResponseListener from './CoTNewMemberResponseListener';

export default class CoTNewMemberListener extends SassybotEventListener {
  protected readonly event = 'guildMemberAdd';
  protected readonly onEvent = this.listener;
  private readonly responseListener: CoTNewMemberResponseListener;

  constructor(sb: Sassybot) {
    super(sb);
    this.responseListener = new CoTNewMemberResponseListener(sb);
    this.responseListener.init();
  }

  protected async listener({ member }: { member: GuildMember }): Promise<void> {
    if (member.guild.id !== GuildIds.COT_GUILD_ID) {
      return;
    }
    const cotMemberRepo = this.sb.dbConnection.getRepository(COTMember);
    const isCotMember = await cotMemberRepo.findOne({ discordUserId: member.user.id });
    if (!!isCotMember) {
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
    const sasner = await this.sb.getUser(UserIds.SASNER);
    if (sasner) {
      dmSasner = await sasner.createDM();
    } else {
      console.error('unable to find "New" Rank, unable to communicate with Sasner');
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

    this.responseListener.activeMemberList[member.user.id] = {
      joined: new Date(),
      name: '',
      step: 1,
    };
    newMemberChannel.send(
      'Hey, welcome to the Crowne of Thorne server!\n\nFirst Can you please type your FULL FFXIV character name?',
      {
        reply: member,
      },
    );
  }
}
