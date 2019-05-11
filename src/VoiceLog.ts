import {Client, GuildMember, TextChannel, VoiceChannel} from "discord.js";

export default function VoiceLogHandler(client: Client, channelList: Map<string, string>, previousMemberState: GuildMember, currentMemberState: GuildMember): void {
    const now = `(${new Date().toISOString().replace(/T/, " ").replace(/\..+/, "")} GMT)`;
    let leftChannel, joinedChannel;
    if (previousMemberState.voiceChannelID) {
        leftChannel = client.channels.get(previousMemberState.voiceChannelID);
    }
    if (currentMemberState.voiceChannelID) {
        joinedChannel = client.channels.get(currentMemberState.voiceChannelID);
    }

    if (
        (leftChannel && leftChannel.id === '333750400861863936') ||
        (joinedChannel && joinedChannel.id === '333750400861863936')
    ) {
        return;
    }

    let msg = `${now} ${previousMemberState.displayName} (${previousMemberState.user.username}) `;

    if (previousMemberState.voiceChannelID !== currentMemberState.voiceChannelID) { // if the voice channel changed:
        if (previousMemberState.voiceChannelID && !currentMemberState.voiceChannelID) { // and the user moved is no longer in any voice channel:
            // they've left voice
            if (leftChannel instanceof VoiceChannel) {
                msg += `has left ${leftChannel.name}`;
                const channelId = channelList.get(previousMemberState.guild.id);
                if (channelId) {
                    const spamChannel = client.channels.get(channelId);
                    if (spamChannel instanceof TextChannel) {
                        spamChannel.send(msg);
                    }
                }
            }
        } else if (!previousMemberState.voiceChannelID && currentMemberState.voiceChannelID) { // and the user was not previously in a voice
            // the user has joined a new voice chat for the first time
            if (joinedChannel instanceof VoiceChannel) {
                msg += `has joined ${joinedChannel.name}`;
                const channelId = channelList.get(joinedChannel.guild.id);
                if (channelId) {
                    const spamChannel = client.channels.get(channelId);
                    if (spamChannel instanceof TextChannel) {
                        spamChannel.send(msg);
                    }
                }
            }
        } else { // only case left is the user moved from channel to channel
            if (joinedChannel instanceof VoiceChannel && leftChannel instanceof VoiceChannel) {
                const joinedGuildId = joinedChannel.guild.id;
                const leftGuildId = leftChannel.guild.id;
                if (joinedGuildId === leftGuildId) {
                    // same guild, treat as "move"
                    msg += `has moved from: ${leftChannel.name} to: ${joinedChannel.name}`;
                    const channelId = channelList.get(previousMemberState.guild.id);
                    if (channelId) {
                        const spamChannel = client.channels.get(channelId);
                        if (spamChannel instanceof TextChannel) {
                            spamChannel.send(msg);
                        }
                    }
                } else {
                    // joined message for inbound
                    const inboundSpamChannelId = channelList.get(currentMemberState.guild.id);
                    if (inboundSpamChannelId) {
                        const spamChannel = client.channels.get(inboundSpamChannelId);
                        if (spamChannel instanceof TextChannel) {
                            spamChannel.send(msg + `has joined ${joinedChannel.name}`);
                        }
                    }

                    // left message for outbound
                    const outboundSpamChannelId = channelList.get(previousMemberState.guild.id);
                    if (outboundSpamChannelId) {
                        const spamChannel = client.channels.get(outboundSpamChannelId);
                        if (spamChannel instanceof TextChannel) {
                            spamChannel.send(msg + `has left ${leftChannel.name}`);
                        }
                    }
                }
            }
        }
    }
};