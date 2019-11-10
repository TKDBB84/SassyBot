import { Channel, GuildMember, Message, MessageOptions, TextChannel, VoiceChannel } from 'discord.js';
import * as moment from 'moment-timezone';
import { GuildIds, UserIds } from '../consts';
import SpamChannel from '../entity/SpamChannel';
import SassybotEventListener from './SassybotEventListener';

interface IIgnoredVoiceChannelsMap {
  [key: string]: Set<string>;
}

export default class VoiceLogListener extends SassybotEventListener {
  private static readonly TIME_FORMAT = 'HH:MM:SS z';

  private static readonly IGNORED_VOICE_CHANNELS: IIgnoredVoiceChannelsMap = {
    [GuildIds.COT_GUILD_ID]: new Set<string>(['333750400861863936']),
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

  private async getVoiceChannel(channelId: string): Promise<VoiceChannel | null> {
    if (!channelId) {
      return null;
    }
    const channel = this.sb.getChannel(channelId);
    if (this.sb.isVoiceChannel(channel)) {
      return channel;
    }
    return null;
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
      const spamTextChannel = this.sb.getTextChannel(spamChannelEntity.channelId);
      if (spamTextChannel) {
        return spamTextChannel;
      }
    }
    return null;
  }

  private async listener(previousMemberState: GuildMember, currentMemberState: GuildMember) {
    let [
      userLeftChannel,
      leftSpamChannel,
      leftTimezone,
      userJoinedChannel,
      joinedSpamChannel,
      joinTimezone,
    ] = await Promise.all([
      this.getVoiceChannel(previousMemberState.voiceChannelID),
      this.getSpamTextChannel(previousMemberState.guild.id),
      this.getSpamChannelTimezone(previousMemberState.guild.id),
      this.getVoiceChannel(currentMemberState.voiceChannelID),
      this.getSpamTextChannel(currentMemberState.guild.id),
      this.getSpamChannelTimezone(currentMemberState.guild.id),
    ]);

    if (
      userLeftChannel &&
      VoiceLogListener.IGNORED_VOICE_CHANNELS[userLeftChannel.guild.id] &&
      VoiceLogListener.IGNORED_VOICE_CHANNELS[previousMemberState.guild.id].has(userLeftChannel.id)
    ) {
      userLeftChannel = null;
      leftSpamChannel = null;
      leftTimezone = 'UTC';
    }
    if (
      userJoinedChannel &&
      VoiceLogListener.IGNORED_VOICE_CHANNELS[userJoinedChannel.guild.id] &&
      VoiceLogListener.IGNORED_VOICE_CHANNELS[previousMemberState.guild.id].has(userJoinedChannel.id)
    ) {
      userJoinedChannel = null;
      joinedSpamChannel = null;
      joinTimezone = 'UTC';
    }
    if (!userLeftChannel && !userJoinedChannel) {
      return;
    }

    const previousMemberName: string = `${previousMemberState.displayName} (${previousMemberState.user.username})`;
    const leftNow: moment.Moment = moment().tz(leftTimezone ? leftTimezone : 'UTC');

    const currentMemberName: string = `${currentMemberState.displayName} (${currentMemberState.user.username})`;
    const joinedNow: moment.Moment = moment().tz(joinTimezone ? joinTimezone : 'UTC');

    if (userLeftChannel && userJoinedChannel) {
      const leftAndJoinedSameGuild = userLeftChannel.guild.id === userJoinedChannel.guild.id;
      // user moved
      if (userJoinedChannel.id !== userLeftChannel.id) {
        if (leftAndJoinedSameGuild) {
          // moved within server
          let spamChannel = leftSpamChannel;
          let time = `(${leftNow.format(VoiceLogListener.TIME_FORMAT)})`;
          if (!spamChannel) {
            spamChannel = joinedSpamChannel;
            time = `(${joinedNow.format(VoiceLogListener.TIME_FORMAT)})`;
          }
          if (spamChannel) {
            spamChannel.send(
              `${time} ${currentMemberName} has moved from: ${userLeftChannel.name} to: ${userJoinedChannel.name}`,
            );
          }
          return;
        } else {
          // moved between servers
          await VoiceLogListener.sendLeftMessage(
            leftSpamChannel,
            leftNow.format(VoiceLogListener.TIME_FORMAT),
            userLeftChannel.name,
            previousMemberName,
          );
          await VoiceLogListener.sendJoinedMessage(
            joinedSpamChannel,
            joinedNow.format(VoiceLogListener.TIME_FORMAT),
            userJoinedChannel.name,
            currentMemberName,
          );
          return;
        }
      } else {
        const sasner = await this.sb.getUser(UserIds.SASNER);
        if (sasner) {
          sasner.send(
            `weird left/rejoined same channel: ${JSON.stringify({ previousMemberState, currentMemberState })}`,
            {
              split: true,
            },
          );
        }
        return;
      }
    }
    if (userJoinedChannel && !userLeftChannel) {
      await VoiceLogListener.sendJoinedMessage(
        joinedSpamChannel,
        joinedNow.format(VoiceLogListener.TIME_FORMAT),
        userJoinedChannel.name,
        currentMemberName,
      );
      return;
    }
    if (userLeftChannel && !userJoinedChannel) {
      await VoiceLogListener.sendLeftMessage(
        leftSpamChannel,
        leftNow.format(VoiceLogListener.TIME_FORMAT),
        userLeftChannel.name,
        previousMemberName,
      );
      return;
    }
  }
}
