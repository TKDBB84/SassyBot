import { Message, TextChannel, VoiceState } from 'discord.js';
import moment from 'moment';
import 'moment-timezone';
import { GuildIds } from '../consts';
import SpamChannel from '../entity/SpamChannel';
import SassybotEventListener from './SassybotEventListener';

interface IIgnoredVoiceChannelsMap {
  [key: string]: Set<string>;
}

export default class VoiceLogListener extends SassybotEventListener {
  private static readonly TIME_FORMAT = 'HH:mm z';

  private static readonly IGNORED_VOICE_CHANNELS: IIgnoredVoiceChannelsMap = {
    [GuildIds.COT_GUILD_ID]: new Set<string>(['597969171384500240']),
    [GuildIds.GAMEZZZ_GUILD_ID]: new Set<string>(),
    [GuildIds.SASNERS_TEST_SERVER_GUILD_ID]: new Set<string>(),
  };

  private static async sendLeftMessage(
    channel: TextChannel,
    channelName: string,
    charName: string,
    timezone = 'UTC',
  ): Promise<Message | Message[] | void> {
    return await channel.send({
      content: `(${moment().tz(timezone).format(VoiceLogListener.TIME_FORMAT)}) ${charName} left: ${channelName}`,
    });
  }

  private static async sendJoinedMessage(
    channel: TextChannel,
    channelName: string,
    charName: string,
    timezone = 'UTC',
  ): Promise<Message | Message[] | void> {
    return await channel.send({
      content: `(${moment().tz(timezone).format(VoiceLogListener.TIME_FORMAT)}) ${charName} joined: ${channelName}`,
    });
  }

  private static async sendMovedMessage(
    channel: TextChannel,
    fromChannelName: string,
    toChannelName: string,
    charName: string,
    timezone = 'UTC',
  ): Promise<Message | Message[] | void> {
    return await channel.send({
      content: `(${moment()
        .tz(timezone)
        .format(VoiceLogListener.TIME_FORMAT)}) ${charName} has moved from: ${fromChannelName}\tto: ${toChannelName}`,
    });
  }
  public readonly event = 'voiceStateUpdate';
  public getEventListener(): (previousMemberState: VoiceState, currentMemberState: VoiceState) => Promise<void> {
    return this.listener.bind(this);
  }

  private async getSpamChannelTimezone(guildId: string): Promise<string> {
    const spamChannelEntity = await this.sb.dbConnection.manager.findOne<SpamChannel>(SpamChannel, {
      guildId,
    });
    if (spamChannelEntity && spamChannelEntity.timezone) {
      return spamChannelEntity.timezone;
    }
    return 'UTC';
  }

  private async getSpamTextChannel(guildId: string): Promise<TextChannel | null> {
    const spamChannelEntity = await this.sb.dbConnection.manager.findOne<SpamChannel>(SpamChannel, {
      guildId,
    });
    if (spamChannelEntity && spamChannelEntity.channelId) {
      const spamTextChannel = await this.sb.getTextChannel(spamChannelEntity.channelId);
      if (spamTextChannel) {
        return spamTextChannel;
      }
    }
    return null;
  }

  private async listener(previousMemberState: VoiceState, currentMemberState: VoiceState): Promise<void> {
    const promiseResolution = await Promise.all([
      previousMemberState.channel,
      currentMemberState.channel,
      this.getSpamTextChannel(previousMemberState.guild.id),
      this.getSpamChannelTimezone(previousMemberState.guild.id),
    ]);

    let [userLeftChannel, userJoinedChannel] = promiseResolution;
    const [, , spamChannel, timezone] = promiseResolution;
    if (!spamChannel || (!userLeftChannel && !userJoinedChannel)) {
      return;
    }

    if (
      VoiceLogListener.IGNORED_VOICE_CHANNELS[previousMemberState.guild.id].has(
        previousMemberState.channelId || 'not-in-array',
      )
    ) {
      userLeftChannel = null;
    }

    if (
      VoiceLogListener.IGNORED_VOICE_CHANNELS[currentMemberState.guild.id].has(
        currentMemberState.channelId || 'not-in-array',
      )
    ) {
      userJoinedChannel = null;
    }

    const [previousMemberName, currentMemberName] = [previousMemberState, currentMemberState].map((memberState) => {
      const memberDisplayName = (memberState.member?.displayName || '').trim();
      const memberUsername = (memberState.member?.user.username || '').trim();
      if (memberUsername && memberUsername !== memberDisplayName) {
        return `${memberDisplayName} (${memberUsername})`;
      }
      return memberDisplayName;
    });

    if (userLeftChannel && userJoinedChannel && userJoinedChannel.id !== userLeftChannel.id) {
      // moved within server
      await VoiceLogListener.sendMovedMessage(
        spamChannel,
        userLeftChannel.name,
        userJoinedChannel.name,
        currentMemberName,
        timezone,
      );
    } else if (userJoinedChannel && !userLeftChannel) {
      await VoiceLogListener.sendJoinedMessage(spamChannel, userJoinedChannel.name, currentMemberName, timezone);
    } else if (userLeftChannel && !userJoinedChannel) {
      await VoiceLogListener.sendLeftMessage(spamChannel, userLeftChannel.name, previousMemberName, timezone);
    }
  }
}
