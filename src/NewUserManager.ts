import { GuildMember, Message, MessageOptions, Role, TextChannel } from 'discord.js';
import { CoTMember, fetchCoTRoles } from './CoTMembers';

const COT_ID = '324682549206974473';
const COT_NEW_USER_CHANNEL = '601971412000833556';
let cotNewUserChannel: TextChannel;

interface INewMemberList {
  [key: string]: {
    name: string;
    joined: Date;
    step: number;
  };
}
const newMemberList: INewMemberList = {};

const quietSendMessageToNewChannel = (user: GuildMember, text: string): Promise<Message | Message[]> => {
  const options: MessageOptions = {
    disableEveryone: true,
    split: true,
  };
  if (!cotNewUserChannel) {
    const cotChannel = user.client.channels.get(COT_NEW_USER_CHANNEL);
    if (cotChannel && cotChannel instanceof TextChannel) {
      cotNewUserChannel = cotChannel;
    }
  }
  return cotNewUserChannel.send(text, options);
};

const sendMessageToNewChannel = (user: GuildMember, text: string): Promise<Message | Message[]> => {
  const options: MessageOptions = {
    disableEveryone: true,
    reply: user,
    split: true,
  };
  if (!cotNewUserChannel) {
    const cotChannel = user.client.channels.get(COT_NEW_USER_CHANNEL);
    if (cotChannel && cotChannel instanceof TextChannel) {
      cotNewUserChannel = cotChannel;
    }
  }
  return cotNewUserChannel.send(text, options);
};

const newMemberJoined = async (member: GuildMember): Promise<void> => {
  const cotRoles = fetchCoTRoles(member);
  if (member.guild.id === COT_ID && cotRoles.New) {
    const roleToAdd: Role | null = cotRoles.New;
    if (roleToAdd) {
      try {
        await member.addRole(roleToAdd.id, 'new member');
        newMemberList[member.user.id] = {
          joined: new Date(),
          name: '',
          step: 1,
        };
        await sendMessageToNewChannel(
          member,
          'Hey, welcome to the Crowne of Thorne server!\n\nFirst Can you please type your FULL FFXIV character name?',
        );
      } catch (e) {
        console.error(
          'unable to add new member rank:  member has no rank, and thus should have access to everything: ',
          { e },
        );
      }
    } else {
      console.error(
        'Unable to find the necessary Ranks to add to new members: member has no rank, and thus should have access to everything: ',
        { cotRoles },
      );
    }
  }
};

const onboardingStep1 = async (message: Message): Promise<void> => {
  const declaredName = message.cleanContent.trim();
  let apiUser: CoTMember | false = false;
  try {
    apiUser = CoTMember.getMemberFromAPIByName({ name: declaredName, userId: message.member.id });
    const guildMembersByName = CoTMember.findByName(declaredName);
    let guildMemberByName: CoTMember | false = false;
    if (guildMembersByName && guildMembersByName.length === 1) {
      guildMemberByName = guildMembersByName[0];
    }
    if (guildMemberByName) {
      if (apiUser) {
        CoTMember.updateAPIUserId({ name: declaredName, userId: message.member.id });
        guildMemberByName.rank = apiUser.rank;
        guildMemberByName.setRank();
      }
    } else {
      let rank = 'New';
      if (apiUser) {
        rank = apiUser.rank;
      }
      const guildMember = new CoTMember(message.member.id, declaredName, rank);
      guildMember.addMember();
    }
  } catch (e) {
    console.error('unable to add to DB', { declaredName });
  }

  const nextStepMessage =
    'This is a quick verification process requiring you to read through our rules and become familiar with the rank guidelines for promotions/absences. \n\n' +
    'Once you\'ve done that, please type "I Agree" and you\'ll be granted full access to the server! We hope you enjoy your stay 😃';
  try {
    await message.member.setNickname(declaredName, 'Declared Character Name');

    await sendMessageToNewChannel(message.member, `Thank you! I have updated your discord nickname to match.\n`);
    if (apiUser) {
      await quietSendMessageToNewChannel(
        message.member,
        `I've found your FC membership, it looks like you're currently a: ${apiUser.rank}, i'll be sure to set that for you when we're done.`,
      );
    }
    await quietSendMessageToNewChannel(message.member, `\n\n${nextStepMessage}`);
    newMemberList[message.member.id].step = 2;
  } catch (e) {
    console.error('unable to update nickname: ', { e });
    await sendMessageToNewChannel(
      message.member,
      `Thank you! I was unable to updated your discord nickname, would you please change it to match your character name when you have a moment?.`,
    );
    if (apiUser) {
      await quietSendMessageToNewChannel(
        message.member,
        `I've found your FC membership, it looks like you're currently a: ${apiUser.rank}, i'll be sure to set that for you when we're done.`,
      );
    }
    await quietSendMessageToNewChannel(message.member, `\n\n${nextStepMessage}`);
    newMemberList[message.member.id].step = 2;
  }
};

const onboardingStep2 = async (message: Message): Promise<boolean> => {
  const cotRoles = fetchCoTRoles(message.member);
  if (message.cleanContent.trim().toLowerCase() === 'i agree') {
    try {
      const foundMember = CoTMember.fetchMember(message.member.id);
      if (foundMember) {
        foundMember.promote();
      }
    } catch (err) {
      console.error({ context: 'could not do DB work for new user', err });
    }
    const roleToRemove = cotRoles.New;
    if (roleToRemove) {
      try {
        await message.member.removeRole(roleToRemove.id);
      } catch (e) {
        console.error({
          error: e,
          member: message.member,
          rankToRemove: roleToRemove,
        });
        await sendMessageToNewChannel(
          message.member,
          "Sorry I'm a terrible bot, I wasn't able to remove your 'New' status, please contact @Sasner#1337 or @Zed#8495 for help.",
        );
        return false;
      }
      if (cotRoles.Recruit) {
        try {
          await message.member.addRole(cotRoles.Recruit);
          await sendMessageToNewChannel(message.member, 'Thank You & Welcome to Crowne Of Thorne');
          return true;
        } catch (e) {
          console.error({
            error: e,
            member: message.member,
            rankToRemove: cotRoles.Recruit,
          });
          await sendMessageToNewChannel(
            message.member,
            "Sorry I'm a terrible bot, I wasn't able to add your Recruit Rank, please contact @Sasner#1337 or @Zed#8495 for help.",
          );
          return false;
        }
      } else {
        console.error('Unable to find the necessary Ranks to add to new members', { cotRoles });
        await sendMessageToNewChannel(
          message.member,
          'Sorry, I was unable to find the Recruit Rank, please contact @Sasner#1337 or @Zed#8495 for help',
        );
        return false;
      }
    } else {
      console.error('Unable to find the necessary Ranks to add to new members', { cotRoles });
      await sendMessageToNewChannel(
        message.member,
        'Sorry, something has gone horribly wrong, please contact @Sasner#1337 or @Zed#8495 for help',
      );
      return false;
    }
  }
  return true;
};

const newMemberListen = async (message: Message) => {
  if (message.channel.type === 'dm') {
    return;
  }
  const cotRoles = fetchCoTRoles(message.member);
  if (message.channel.id !== COT_NEW_USER_CHANNEL || !newMemberList.hasOwnProperty(message.member.id)) {
    return false;
  }
  const roleToCheck = cotRoles.New;
  if (!roleToCheck) {
    console.error('Unable to find the necessary Ranks to add to new members', {
      cotRoles,
    });
    await sendMessageToNewChannel(
      message.member,
      'Sorry, something has gone horribly wrong, please contact @Sasner#1337 or @Zed#8495 for help',
    );
    return false;
  }
  if (!message.member.roles.has(roleToCheck.id)) {
    console.error('user without lower rank && on new member list is still in channel... ?');
    return false;
  }

  if (newMemberList[message.member.id].step === 1) {
    await onboardingStep1(message);
  } else if (newMemberList[message.member.id].step === 2) {
    const result = await onboardingStep2(message);
    if (result) {
      delete newMemberList[message.member.id];
    }
  } else {
    console.error('onboarding step out of bounds', {
      newMember: newMemberList[message.member.id],
    });
    await sendMessageToNewChannel(
      message.member,
      'Sorry, something has gone horribly wrong, please contact @Sasner#1337 or @Zed#8495 for help',
    );
  }
  return true;
};

export let newMemberJoinedCallback = newMemberJoined;

export async function newMemberListener(message: Message) {
  return await newMemberListen(message);
}
