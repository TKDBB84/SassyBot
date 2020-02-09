import { GuildMember, Message, MessageOptions, TextChannel, VoiceChannel } from 'discord.js';
import * as moment from 'moment-timezone';
import { GuildIds, UserIds } from '../consts';
import SpamChannel from '../entity/SpamChannel';
import SassybotEventListener from './SassybotEventListener';

interface IIgnoredVoiceChannelsMap {
  [key: string]: Set<string>;
}

export default class VoiceLogListener extends SassybotEventListener {
  private static readonly TIME_FORMAT = 'HH:MM z';

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

  private async listener({
    oldMember: previousMemberState,
    newMember: currentMemberState,
  }: {
    oldMember: GuildMember;
    newMember: GuildMember;
  }) {
    const [userLeftChannel, userJoinedChannel, spamChannel, timezone] = await Promise.all([
      this.getVoiceChannel(previousMemberState?.voiceChannelID || ''),
      this.getVoiceChannel(currentMemberState?.voiceChannelID || ''),
      this.getSpamTextChannel(previousMemberState.guild.id),
      this.getSpamChannelTimezone(previousMemberState.guild.id),
    ]);

    if (!userLeftChannel && !userJoinedChannel) {
      return;
    }

    const previousMemberName: string = `${previousMemberState.displayName} (${previousMemberState.user.username})`;
    const leftNow: moment.Moment = moment().tz(timezone ? timezone : 'UTC');

    const currentMemberName: string = `${currentMemberState.displayName} (${currentMemberState.user.username})`;
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
      } else {
        const sasner = await this.sb.getUser(UserIds.SASNER);
        if (sasner) {
          await sasner.send(
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
