import {GuildMember, Message, MessageOptions, Role, TextChannel} from "discord.js";
import * as Discord from "discord.js";
import {futimes} from "fs";

const client = new Discord.Client();
const COT_ID = '324682549206974473';
const COT_NEW_USER_CHANNEL = '601971412000833556';
let cotNewUserChannel: TextChannel;
type roleList = {
    new?: Role,
    verified?: Role,
}
const cotRoles: roleList = {};

type newMemberList = {
    [key: string]: {
        name: string,
        joined: Date,
    }
}
const newMemberList: newMemberList = {};

const newMemberJoined = (member: GuildMember) => {
    if (!cotNewUserChannel) {
        const cotChannel = client.channels.get(COT_NEW_USER_CHANNEL);
        if (cotChannel && cotChannel instanceof TextChannel) {
            cotNewUserChannel = cotChannel;
        }
    }

    const cot = client.guilds.get(COT_ID);
    if (!cotRoles.new) {
        if (cot) {
            const cotRole = cot.roles.find(role => role.name === 'New');
            if (cotRole) {
                cotRoles.new = cotRole;
            }
        }
    }

    if (!cotRoles.verified) {
        if (cot) {
            const cotRole = cot.roles.find(role => role.name === 'Verified')
            if (cotRole) {
                cotRoles.verified = cotRole;
            }
        }
    }

    if (member.guild.id === COT_ID && cotRoles.new && cotNewUserChannel) {
        member.addRole(cotRoles.new.id, 'new member').then(() => {
            const options: MessageOptions = {
                disableEveryone: true,
                split: true,
                reply: member.user.id,
            };
            newMemberList[member.user.id] = {
                name: '',
                joined: new Date(),
            };
            cotNewUserChannel.send('do something to gain access', options).then((message: Message | Message[]) => {
                if (!Array.isArray(message)) {
                    message = [message];
                }
                message.forEach(msg => {
                    msg.delete(2000);
                });
            })
        });
    }
};


const newMemberListen = (message: Message) => {
    if (message.channel.id !== COT_NEW_USER_CHANNEL) {
        return false;
    }

    if (cotRoles.new && !message.member.roles.has(cotRoles.new.id)) {
        return false;
    }

    if (newMemberList.hasOwnProperty(message.member.id) && cotRoles.new && cotRoles.verified) {
        newMemberList[message.member.id].name = message.cleanContent;
        message.member.setNickname(message.cleanContent, 'Declared Character Name');
        message.member.addRole(cotRoles.verified.id);
        message.member.removeRole(cotRoles.new.id);
        return true;
    }

    return false;
};

export let newMemberJoinedCallback = newMemberJoined;

export function newMemberListener(message: Message) {
    return newMemberListen(message);
};
