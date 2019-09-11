import { Channel, GuildMember, Message, MessageOptions, TextChannel, VoiceChannel } from 'discord.js';
import * as moment from 'moment-timezone';
import { GuildIds, UserIds } from '../consts';
import { SpamChannel } from '../entity/SpamChannel';
import SassybotEventListener from './SassybotEventListener';

interface IIgnoredVoiceChannelsMap {
  [key: string]: Set<string>;
}

export default class VoiceLog extends SassybotEventListener {
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
        disableEveryone: true,
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
        disableEveryone: true,
        split: false,
      };
      return await channel.send(`(${time}) ${charName} joined: ${channelName}`, options);
    }
  }
  protected readonly event = 'voiceStateUpdate';
  protected readonly onEvent = this.listener;

  private async getVoiceChannel(channelId: string): Promise<VoiceChannel | null> {
    if (!channelId) {
      return null;
    }
    const channel = this.sb.getChannel(channelId);
    if (channel && channel instanceof VoiceChannel) {
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
    let spamChannel: Channel | null;
    const spamChannelEntity = await this.sb.dbConnection.manager.findOne<SpamChannel>(SpamChannel, {
      guildId,
    });
    if (spamChannelEntity && spamChannelEntity.channelId) {
      spamChannel = this.sb.getChannel(spamChannelEntity.channelId);
      if (spamChannel && spamChannel instanceof TextChannel) {
        return spamChannel;
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
      VoiceLog.IGNORED_VOICE_CHANNELS[userLeftChannel.guild.id] &&
      VoiceLog.IGNORED_VOICE_CHANNELS[previousMemberState.guild.id].has(userLeftChannel.id)
    ) {
      userLeftChannel = null;
      leftSpamChannel = null;
      leftTimezone = 'UTC';
    }
    if (
      userJoinedChannel &&
      VoiceLog.IGNORED_VOICE_CHANNELS[userJoinedChannel.guild.id] &&
      VoiceLog.IGNORED_VOICE_CHANNELS[previousMemberState.guild.id].has(userJoinedChannel.id)
    ) {
      userJoinedChannel = null;
      joinedSpamChannel = null;
      joinTimezone = 'UTC';
    }
    if (!userLeftChannel && !userJoinedChannel) {
      return;
    }

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
          let time = `(${leftNow.format(VoiceLog.TIME_FORMAT)})`;
          if (!spamChannel) {
            spamChannel = joinedSpamChannel;
            time = `(${joinedNow.format(VoiceLog.TIME_FORMAT)})`;
          }
          if (spamChannel) {
            spamChannel.send(
              `${time} ${currentMemberName} has moved from: ${userLeftChannel.name} to: ${userJoinedChannel.name}`,
            );
          }
          return;
        } else {
          // moved between servers
          await VoiceLog.sendLeftMessage(
            leftSpamChannel,
            leftNow.format(VoiceLog.TIME_FORMAT),
            userLeftChannel.name,
            previousMemberName,
          );
          await VoiceLog.sendJoinedMessage(
            joinedSpamChannel,
            joinedNow.format(VoiceLog.TIME_FORMAT),
            userJoinedChannel.name,
            currentMemberName,
          );
          return;
        }
      } else {
        const sasner = await this.sb.fetchUser(UserIds.SASNER);
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
      await VoiceLog.sendJoinedMessage(
        joinedSpamChannel,
        joinedNow.format(VoiceLog.TIME_FORMAT),
        userJoinedChannel.name,
        currentMemberName,
      );
      return;
    }
    if (userLeftChannel && !userJoinedChannel) {
      await VoiceLog.sendLeftMessage(
        leftSpamChannel,
        leftNow.format(VoiceLog.TIME_FORMAT),
        userLeftChannel.name,
        previousMemberName,
      );
      return;
    }
  }
}
