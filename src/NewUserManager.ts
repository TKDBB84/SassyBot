import {GuildMember, Message, MessageOptions, Role, TextChannel} from "discord.js";
import {CoTMember} from "./CoTMembers";

let TESTING = false;
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

const fetchCoTRoles: (member: GuildMember) => void = (member) => {
    const cot = member.guild;
    if (cot) {
        Object.keys(cotRoles).forEach((rank: string) => {
            if (cotRoles.hasOwnProperty(rank) && !cotRoles[rank]) {
                const cotRole = cot.roles.find(role => role.name === rank);
                if (cotRole) {
                    cotRoles[rank] = cotRole;
                }
            }
        });
    }
};

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
    fetchCoTRoles(member);

    if (member.guild.id === COT_ID && cotRoles.New) {
        let roleToAdd: Role | null = cotRoles.New;
        if (TESTING && cotRoles['new role']) {
            roleToAdd = cotRoles['new role'];
        }
        if (roleToAdd) {
            member.addRole(roleToAdd.id, 'new member').then(() => {
                newMemberList[member.user.id] = {
                    name: '',
                    joined: new Date(),
                    step: 1,
                };
                sendMessageToNewChannel(member, 'Hey, welcome to the Crowne of Thorne server! \n\n' + 'First Can you please type your FULL FFXIV character name?');
            }).catch(console.error);
        } else {
            console.error('Unable to find the necessary Ranks to add to new members', {cotRoles})
        }
    }
};

const updateNickname = (member: GuildMember, newNickName: string, reason: string = 'Declared Character Name') => {
    return member.setNickname(newNickName, reason)
};

const onboardingStep1 = (message: Message) => {
    const nextStepMessage = 'This is a quick verification process requiring you to read through our rules and become familiar with the rank guidelines for promotions/absences. \n' +
        '\n' +
        'Once you\'ve done that, please type "I Agree" and you\'ll be granted full access to the server! We hope you enjoy your stay 😃';
    const declaredName = message.cleanContent;
    const foundMember = CoTMember.fetchMember(message.member.id);
    if (!foundMember) {
        const newMember = new CoTMember(message.member.id, declaredName);
        try {
            newMember.save();
        } catch (e) {
            console.error('unable to add to DB', {newMember})
        }
    }

    updateNickname(message.member, declaredName).then(() => {
        sendMessageToNewChannel(message.member, `Thank you! I have updated your discord nickname to match.\n\n${nextStepMessage}`);
        newMemberList[message.member.id].step = 2;
    }).catch(e => {
        console.error('unable to update nickname: ', {e});
        sendMessageToNewChannel(message.member, `Thank you! I was unable to updated your discord nickname, would you please change it to match your character name when you have a moment?.\n\n${nextStepMessage}`);
        newMemberList[message.member.id].step = 2;
    });
};

const onboardingStep2 = (message: Message) => {
    if (message.cleanContent.trim().toLowerCase() === 'i agree') {
        let roleToRemove: Role | null = cotRoles.New;
        if (TESTING) {
            roleToRemove = cotRoles['new role'];
        }
        if (roleToRemove) {
            message.member.removeRole(roleToRemove.id).catch((e) => {
                console.error({error: e, member: message.member, rankToRemove: roleToRemove});
                sendMessageToNewChannel(message.member, "Sorry I'm a terrible bot, I wasn't able to remove your 'New' status, please contact @Sasner#1337 or @Zed#8495 for help.");
            });
            if (cotRoles.Recruit) {
                message.member.addRole(cotRoles.Recruit).catch((e) => {
                    console.error({error: e, member: message.member, rankToRemove: cotRoles.Recruit});
                    sendMessageToNewChannel(message.member, "Sorry I'm a terrible bot, I wasn't able to add your Recruit Rank, please contact @Sasner#1337 or @Zed#8495 for help.");
                });
            } else {
                console.error('Unable to find the necessary Ranks to add to new members', {cotRoles});
                sendMessageToNewChannel(message.member, 'Sorry, I was unable to find the Recruit Rank, please contact @Sasner#1337 or @Zed#8495 for help');
            }
            sendMessageToNewChannel(message.member, 'Thank You & Welcome to Crowne Of Thorne');
        } else {
            console.error('Unable to find the necessary Ranks to add to new members', {cotRoles});
            sendMessageToNewChannel(message.member, 'Sorry, something has gone horribly wrong, please contact @Sasner#1337 or @Zed#8495 for help');
        }
        TESTING = false;
    }
};

const newMemberListen = (message: Message) => {
    if (message.channel.id !== COT_NEW_USER_CHANNEL) {
        return false;
    }
    if (!newMemberList.hasOwnProperty(message.member.id)) {
        return false;
    }

    fetchCoTRoles(message.member);
    let roleToCheck = cotRoles.New;
    if (TESTING) {
        roleToCheck = cotRoles['new role'];
    }
    if (!roleToCheck) {
        console.error('Unable to find the necessary Ranks to add to new members', {cotRoles});
        return false
    }
    if (!message.member.roles.has(roleToCheck.id)) {
        return false;
    }

    if (newMemberList[message.member.id].step === 1) {
        onboardingStep1(message);
    } else if (newMemberList[message.member.id].step === 2) {
        onboardingStep2(message);
    }
    return true;
};

export let newMemberJoinedCallback = newMemberJoined;

export function newMemberListener(message: Message) {
    return newMemberListen(message);
}

export function setNewUserWorkflow(message: Message) {
    TESTING = true;
    newMemberJoined(message.member)
}
