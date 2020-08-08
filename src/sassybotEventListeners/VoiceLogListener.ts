import { Message, MessageOptions, TextChannel, VoiceState } from 'discord.js';
import * as moment from 'moment';
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
    channel: TextChannel | null,
    time: string,
    channelName: string,
    charName: string,
  ): Promise<Message | Message[] | void> {
    if (channel) {
      const options: MessageOptions = {
        split: false,
      };
      return await channel.send(`(${time}) ${charName} left: ${channelName}`, options);
    }
  }

  private static async sendJoinedMessage(
    channel: TextChannel | null,
    time: string,
    channelName: string,
    charName: string,
  ): Promise<Message | Message[] | void> {
    if (channel) {
      const options: MessageOptions = {
        split: false,
      };

      return await channel.send(`(${time}) ${charName} joined: ${channelName}`, options);
    }
  }
  public readonly event = 'voiceStateUpdate';
  public getEventListener() {
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

  private async listener({
    previousMemberState,
    currentMemberState,
  }: {
    previousMemberState: VoiceState;
    currentMemberState: VoiceState;
  }) {
    const promiseResolution = await Promise.all([
      previousMemberState.channel,
      currentMemberState.channel,
      this.getSpamTextChannel(previousMemberState.guild.id),
      this.getSpamChannelTimezone(previousMemberState.guild.id),
    ]);

    let [userLeftChannel, userJoinedChannel] = promiseResolution;
    const [, , spamChannel, timezone] = promiseResolution;

    if (!userLeftChannel && !userJoinedChannel) {
      return;
    }

    if (
      VoiceLogListener.IGNORED_VOICE_CHANNELS[previousMemberState.guild.id].has(
        previousMemberState.channelID || 'not-in-array',
      )
    ) {
      userLeftChannel = null;
    }

    if (
      VoiceLogListener.IGNORED_VOICE_CHANNELS[currentMemberState.guild.id].has(
        currentMemberState.channelID || 'not-in-array',
      )
    ) {
      userJoinedChannel = null;
    }

    let previousMemberName;
    const previousMemberDisplayName = (previousMemberState.member?.displayName || '').trim();
    const previousMemberUsername = (previousMemberState.member?.user.username || '').trim();
    if (previousMemberDisplayName === previousMemberUsername) {
      previousMemberName = previousMemberDisplayName;
    } else {
      previousMemberName = `${previousMemberDisplayName} (${previousMemberUsername})`;
    }

    let currentMemberName;
    const currentMemberDisplayName = (currentMemberState.member?.displayName || '').trim();
    const currentMemberUsername = (currentMemberState.member?.user.username || '').trim();
    if (currentMemberDisplayName === currentMemberUsername) {
      currentMemberName = currentMemberDisplayName;
    } else {
      currentMemberName = `${currentMemberDisplayName} (${currentMemberUsername})`;
    }

    const leftNow: moment.Moment = moment().tz(timezone ? timezone : 'UTC');

    const joinedNow: moment.Moment = moment().tz(timezone ? timezone : 'UTC');

    if (userLeftChannel && userJoinedChannel) {
      // user moved
      if (userJoinedChannel.id !== userLeftChannel.id) {
        // moved within server
        let time = `(${leftNow.format(VoiceLogListener.TIME_FORMAT)})`;
        if (!spamChannel) {
          time = `(${joinedNow.format(VoiceLogListener.TIME_FORMAT)})`;
        }
        if (spamChannel) {
          await spamChannel.send(
            `${time} ${currentMemberName} has moved from: ${userLeftChannel.name}\tto: ${userJoinedChannel.name}`,
          );
        }
        return;
      }
    }
    if (userJoinedChannel && !userLeftChannel) {
      await VoiceLogListener.sendJoinedMessage(
        spamChannel,
        joinedNow.format(VoiceLogListener.TIME_FORMAT),
        userJoinedChannel.name,
        currentMemberName,
      );
      return;
    }
    if (userLeftChannel && !userJoinedChannel) {
      await VoiceLogListener.sendLeftMessage(
        spamChannel,
        leftNow.format(VoiceLogListener.TIME_FORMAT),
        userLeftChannel.name,
        previousMemberName,
      );
      return;
    }
  }
}
