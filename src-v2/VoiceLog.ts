import * as moment from 'moment-timezone';
import { Channel, GuildMember, Message, MessageOptions, TextChannel, VoiceChannel } from 'discord.js';
import { SassyBot } from './SassyBot';
import { GuildIds, UserIds } from './consts';
import { SpamChannel } from './entity/SpamChannel';

type ignoredVoiceChannelsMap = {
  [key: string]: Set<string>;
};

const TIME_FORMAT = 'HH:MM:SS z';

const ignoredVoiceChannels: ignoredVoiceChannelsMap = {
  [GuildIds.COT_GUILD_ID]: new Set<string>(['333750400861863936']),
  [GuildIds.GAMEZZZ_GUILD_ID]: new Set<string>(),
  [GuildIds.SASNERS_TEST_SERVER_GUILD_ID]: new Set<string>(),
};

async function sendLeftMessage(
  channel: TextChannel | null,
  time: string,
  channelName: string,
  charName: string,
): Promise<Message | Message[] | void> {
  if (channel) {
    const options: MessageOptions = {
      disableEveryone: true,
      split: false,
    };
    return await channel.send(`(${time}) ${charName} left: ${channelName}`, options);
  }
}

async function sendJoinedMessage(
  channel: TextChannel | null,
  time: string,
  channelName: string,
  charName: string,
): Promise<Message | Message[] | void> {
  if (channel) {
    const options: MessageOptions = {
      disableEveryone: true,
      split: false,
    };
    return await channel.send(`(${time}) ${charName} joined: ${channelName}`, options);
  }
}

async function getVoiceChannel(sb: SassyBot, channelId: string): Promise<VoiceChannel | null> {
  if (!channelId) {
    return null;
  }
  const channel = sb.discordClient.channels.get(channelId);
  if (channel && channel instanceof VoiceChannel) {
    return channel;
  }
  return null;
}

async function getSpamChannelTimezone(sb: SassyBot, guildId: string): Promise<string> {
  const spamChannelEntity = await sb.dbConnection.manager.findOne<SpamChannel>(SpamChannel, {
    guildId,
  });
  if (spamChannelEntity && spamChannelEntity.timezone) {
    return spamChannelEntity.timezone;
  }
  return 'UTC';
}

async function getSpamTextChannel(sb: SassyBot, guildId: string): Promise<TextChannel | null> {
  let spamChannel: Channel | null;
  const spamChannelEntity = await sb.dbConnection.manager.findOne<SpamChannel>(SpamChannel, {
    guildId,
  });
  if (spamChannelEntity && spamChannelEntity.channelId) {
    spamChannel = sb.discordClient.channels.find((channel) => channel.id === spamChannelEntity.channelId);
    if (spamChannel && spamChannel instanceof TextChannel) {
      return spamChannel;
    }
  }
  return null;
}

async function logVoiceChatConnection(sb: SassyBot, previousMemberState: GuildMember, currentMemberState: GuildMember) {
  let userLeftChannel = !!sb.discordClient.channels.get(previousMemberState.voiceChannelID);
  let leftSpamChannel: TextChannel | null = null;
  let channelLeft: VoiceChannel | null = null;
  let leftNow: moment.Moment | null = null;
  let previousMemberName: string = `${previousMemberState.displayName} (${previousMemberState.user.username})`;

  let userJoinedChannel = !!sb.discordClient.channels.get(currentMemberState.voiceChannelID);
  let joinedSpamChannel: TextChannel | null = null;
  let channelJoined: VoiceChannel | null = null;
  let joinedNow: moment.Moment | null = null;
  let currentMemberName: string = `${currentMemberState.displayName} (${currentMemberState.user.username})`;

  if (userLeftChannel) {
    leftSpamChannel = await getSpamTextChannel(sb, previousMemberState.guild.id);
    channelLeft = await getVoiceChannel(sb, previousMemberState.voiceChannelID);
    leftNow = moment().tz(await getSpamChannelTimezone(sb, previousMemberState.guild.id));
    if (
      channelLeft &&
      ignoredVoiceChannels.hasOwnProperty(previousMemberState.guild.id) &&
      ignoredVoiceChannels[previousMemberState.guild.id].has(channelLeft.id)
    ) {
      leftSpamChannel = null;
      channelLeft = null;
      leftNow = null;
    }
  }

  if (userJoinedChannel) {
    joinedSpamChannel = await getSpamTextChannel(sb, currentMemberState.guild.id);
    channelJoined = await getVoiceChannel(sb, currentMemberState.voiceChannelID);
    joinedNow = moment().tz(await getSpamChannelTimezone(sb, currentMemberState.guild.id));
    if (
      channelJoined &&
      ignoredVoiceChannels.hasOwnProperty(currentMemberState.guild.id) &&
      ignoredVoiceChannels[currentMemberState.guild.id].has(channelJoined.id)
    ) {
      joinedSpamChannel = null;
      channelJoined = null;
      joinedNow = null;
    }
  }

  if (channelJoined && channelLeft) {
    const leftAndJoinedSameGuild = channelLeft.guild.id === channelJoined.guild.id;
    // user moved
    if (channelJoined.id === channelLeft.id) {
      const sasner = await sb.discordClient.fetchUser(UserIds.SASNER);
      if (sasner) {
        sasner.send(`left/rejoined same channel: ${JSON.stringify({ previousMemberState, currentMemberState })}`, {
          split: true,
          disableEveryone: true,
        });
      }
      return;
    } else {
      if (leftAndJoinedSameGuild) {
        // moved within server
        let spamChannel = leftSpamChannel;
        if (!spamChannel) {
          spamChannel = joinedSpamChannel;
        }
        let time = '';
        if (leftNow) {
          time = `(${leftNow.format(TIME_FORMAT)})`;
        } else if (joinedNow) {
          time = `(${joinedNow.format(TIME_FORMAT)})`;
        }
        if (spamChannel) {
          spamChannel.send(
            `${time} ${currentMemberName} has moved from: ${channelLeft.name} to: ${channelJoined.name}`,
          );
        }
        return;
      } else {
        // moved between servers
        await sendLeftMessage(
          leftSpamChannel,
          leftNow ? leftNow.format(TIME_FORMAT) : '',
          channelLeft.name,
          previousMemberName,
        );
        await sendJoinedMessage(
          joinedSpamChannel,
          joinedNow ? joinedNow.format(TIME_FORMAT) : '',
          channelJoined.name,
          currentMemberName,
        );
        return;
      }
    }
  }

  if (channelJoined && !channelLeft) {
    await sendJoinedMessage(
      joinedSpamChannel,
      joinedNow ? joinedNow.format(TIME_FORMAT) : '',
      channelJoined.name,
      currentMemberName,
    );
    return;
  }
  if (channelLeft && !channelJoined) {
    await sendLeftMessage(
      leftSpamChannel,
      leftNow ? leftNow.format(TIME_FORMAT) : '',
      channelLeft.name,
      previousMemberName,
    );
    return;
  }
}

export default async function VoiceLogHandler(sb: SassyBot): Promise<void> {
  sb.discordClient.on('voiceStateUpdate', (newState, oldState) => logVoiceChatConnection(sb, newState, oldState));
}
