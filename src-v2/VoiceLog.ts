import { Channel, GuildMember, Message, MessageOptions, TextChannel, VoiceChannel } from 'discord.js';
import * as moment from 'moment-timezone';
import { GuildIds, UserIds } from './consts';
import { SpamChannel } from './entity/SpamChannel';
import { SassyBot } from './SassyBot';

interface IIgnoredVoiceChannelsMap {
  [key: string]: Set<string>;
}

const TIME_FORMAT = 'HH:MM:SS z';

const ignoredVoiceChannels: IIgnoredVoiceChannelsMap = {
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
  const channel = sb.getChannel(channelId);
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
    spamChannel = sb.getChannel(spamChannelEntity.channelId);
    if (spamChannel && spamChannel instanceof TextChannel) {
      return spamChannel;
    }
  }
  return null;
}

async function logVoiceChatConnection(sb: SassyBot, previousMemberState: GuildMember, currentMemberState: GuildMember) {
  const [
    userLeftChannel,
    leftSpamChannel,
    leftTimezone,
    userJoinedChannel,
    joinedSpamChannel,
    joinTimezone,
  ] = await Promise.all([
    getVoiceChannel(sb, previousMemberState.voiceChannelID),
    getSpamTextChannel(sb, previousMemberState.guild.id),
    getSpamChannelTimezone(sb, previousMemberState.guild.id),
    getVoiceChannel(sb, currentMemberState.voiceChannelID),
    getSpamTextChannel(sb, currentMemberState.guild.id),
    getSpamChannelTimezone(sb, currentMemberState.guild.id),
  ]);
  const previousMemberName: string = `${previousMemberState.displayName} (${previousMemberState.user.username})`;
  const leftNow: moment.Moment = moment().tz(leftTimezone);

  const currentMemberName: string = `${currentMemberState.displayName} (${currentMemberState.user.username})`;
  const joinedNow: moment.Moment = moment().tz(joinTimezone);

  if (userLeftChannel && userJoinedChannel) {
    const leftAndJoinedSameGuild = userLeftChannel.guild.id === userJoinedChannel.guild.id;
    // user moved
    if (userJoinedChannel.id !== userLeftChannel.id) {
      if (leftAndJoinedSameGuild) {
        // moved within server
        let spamChannel = leftSpamChannel;
        let time = `(${leftNow.format(TIME_FORMAT)})`;
        if (!spamChannel) {
          spamChannel = joinedSpamChannel;
          time = `(${joinedNow.format(TIME_FORMAT)})`;
        }
        if (spamChannel) {
          spamChannel.send(
            `${time} ${currentMemberName} has moved from: ${userLeftChannel.name} to: ${userJoinedChannel.name}`,
          );
        }
        return;
      } else {
        // moved between servers
        await sendLeftMessage(leftSpamChannel, leftNow.format(TIME_FORMAT), userLeftChannel.name, previousMemberName);
        await sendJoinedMessage(
          joinedSpamChannel,
          joinedNow.format(TIME_FORMAT),
          userJoinedChannel.name,
          currentMemberName,
        );
        return;
      }
    } else {
      const sasner = await sb.fetchUser(UserIds.SASNER);
      if (sasner) {
        sasner.send(
          `weird left/rejoined same channel: ${JSON.stringify({ previousMemberState, currentMemberState })}`,
          {
            disableEveryone: true,
            split: true,
          },
        );
      }
      return;
    }
  }

  if (userJoinedChannel && !userLeftChannel) {
    await sendJoinedMessage(
      joinedSpamChannel,
      joinedNow.format(TIME_FORMAT),
      userJoinedChannel.name,
      currentMemberName,
    );
    return;
  }
  if (userLeftChannel && !userJoinedChannel) {
    await sendLeftMessage(leftSpamChannel, leftNow.format(TIME_FORMAT), userLeftChannel.name, previousMemberName);
    return;
  }
}

export default async function VoiceLogHandler(sb: SassyBot): Promise<void> {
  sb.on('voiceStateUpdate', ({ newState, oldState }) => logVoiceChatConnection(sb, newState, oldState));
}
