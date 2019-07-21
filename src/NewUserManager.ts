import {GuildMember, Message, MessageOptions, Role, TextChannel, UserResolvable} from "discord.js";
import * as Discord from "discord.js";
import { FreeCompanyMember, CoTMember } from "./CoTMembers";
import * as fs from "fs";

type client_secrets = { token: string, xivApiToken: string }
const getSecrets: () => client_secrets = (): client_secrets => {
    const fileData = fs.readFileSync("/home/nodebot/src/client_secrets.json");
    return JSON.parse(fileData.toString());
};
const XIVApi = require('xivapi-js');
export const xivClient = new XIVApi({
    private_key: getSecrets().xivApiToken
});

let TESTING = false;
const client = new Discord.Client();
const COT_ID = '324682549206974473';
const COT_NEW_USER_CHANNEL = '601971412000833556';
let cotNewUserChannel: TextChannel;
type roleList = {
    [key: string]: Role | null
}
const cotRoles: roleList = {
    New: null,
    Verified: null,
    Recruit: null,
    Member: null,
    Veteran: null,
    Officer: null,
    'new role': null,
};

type newMemberList = {
    [key: string]: {
        name: string,
        joined: Date,
        step: number,
    }
}
const newMemberList: newMemberList = {};

const sendMessageToNewChannel = (user: GuildMember, text: String) => {
    const options: MessageOptions = {
        disableEveryone: true,
        split: true,
        reply: user,
    };
    if (!cotNewUserChannel) {
        const cotChannel = user.client.channels.get(COT_NEW_USER_CHANNEL);
        if (cotChannel && cotChannel instanceof TextChannel) {
            cotNewUserChannel = cotChannel;
        }
    }
    cotNewUserChannel.send(text, options);
};

const newMemberJoined = (member: GuildMember) => {
    const cot = member.guild;
    if (cot) {
        Object.keys(cotRoles).forEach((rank: string)=> {
            if (cotRoles.hasOwnProperty(rank) && !cotRoles[rank]) {
                const cotRole = cot.roles.find(role => role.name === rank);
                if (cotRole) {
                    cotRoles[rank] = cotRole;
                }
            }
        });
    }

    if (member.guild.id === COT_ID && cotRoles.New) {
        let roleToAdd: Role | null = cotRoles.New;
        if (TESTING && cotRoles['new role']) {
            roleToAdd = cotRoles['new role'];
        }
        if (roleToAdd) {
            member.addRole(roleToAdd.id, 'new member').then(() => {
                const options: MessageOptions = {
                    disableEveryone: true,
                    split: true,
                    reply: member.user.id,
                };
                newMemberList[member.user.id] = {
                    name: '',
                    joined: new Date(),
                    step: 1,
                };
                sendMessageToNewChannel(member, 'Hey, welcome to the Crowne of Thorne server! \n\n' + 'First Can you please type your FULL FFXIV character name?');
            });
        }
    }
};

const newMemberListen = (message: Message) => {
    if (message.channel.id !== COT_NEW_USER_CHANNEL) {
        return false;
    }

    let roleToCheck = cotRoles.New;
    if (TESTING) {
        roleToCheck = cotRoles['new role'];
    }
    if (roleToCheck && !message.member.roles.has(roleToCheck.id)) {
        return false;
    }

    if (newMemberList.hasOwnProperty(message.member.id)) {
        switch (newMemberList[message.member.id].step) {
            case 1:
                const nextStepMessage =  'This is a quick verification process requiring you to read through our rules and become familiar with the rank guidelines for promotions/absences. \n' +
                    '\n' +
                    'Once you\'ve done that, please type "I Agree" and you\'ll be granted full access to the server! We hope you enjoy your stay 😃';
                const possibleName = message.cleanContent;
                const foundMembers = CoTMember.findByName(message.member.id, possibleName);
                let newMember: CoTMember;
                if (!foundMembers) {
                    xivClient.character.search(possibleName, {server: 'Jenova'}).then(
                        (response: { Results: FreeCompanyMember[] }) => {
                            const charMatch = response.Results.find(c => c.Name === possibleName);
                            if (charMatch) {
                                newMember = new CoTMember(message.member.id, charMatch.ID.toString(), possibleName, 'Recruit');
                            } else {
                                newMember = new CoTMember(message.member.id, '', possibleName, 'Recruit');
                            }
                            newMember.save();
                            sendMessageToNewChannel(message.member, `Thank you, ${newMember.name}!\n\n${nextStepMessage}`);
                            message.member.setNickname(newMember.name, 'Declared Character Name');
                            newMemberList[message.member.id].step = 2;
                        }
                    ).catch(() => {
                        newMember = new CoTMember(message.member.id, '', possibleName, 'Recruit');
                        newMember.save();
                        sendMessageToNewChannel(message.member, `Thank you, ${newMember.name}!\n\n${nextStepMessage}`);
                        message.member.setNickname(newMember.name, 'Declared Character Name');
                        newMemberList[message.member.id].step = 2;
                    });
                } else if (foundMembers.length === 1) {
                    newMember = foundMembers[0];
                    newMember.id = message.member.id;
                    newMember.save();
                    sendMessageToNewChannel(message.member, `Thank you, ${newMember.name}!\n\n${nextStepMessage}`);
                    message.member.setNickname(newMember.name, 'Declared Character Name');
                    newMemberList[message.member.id].step = 2;
                }
                break;
            case 2:
                if (message.cleanContent.trim().toLowerCase() === 'i agree') {
                    let roleToRemove: Role | null = cotRoles.New;
                    if (TESTING) {
                        roleToRemove = cotRoles['new role'];
                    }
                    if (roleToRemove) {
                        message.member.removeRole(roleToRemove.id);
                        const memberObject = CoTMember.fetchMember(message.member.id);
                        if (memberObject instanceof CoTMember) {
                            const memRank = memberObject.rank;
                            const someRank = cotRoles[memRank];
                            if (someRank && someRank.id) {
                                message.member.addRole(someRank.id);
                            }
                        }
                        sendMessageToNewChannel(message.member, 'Thank You & Welcome to Crowne Of Thrones');
                    } else {
                        sendMessageToNewChannel(message.member, 'Sorry, something has gone horribly wrong, please contact @Sasner#1337 or @Zed#8495 for help');
                    }
                    TESTING = false;
                }
                break;
        }
        return true;
    }

    return false;
};

export let newMemberJoinedCallback = newMemberJoined;

export function newMemberListener(message: Message) {
    return newMemberListen(message);
};

export function setNewUserWorkflow(message: Message) {
    TESTING = true;
    newMemberJoined(message.member)
}