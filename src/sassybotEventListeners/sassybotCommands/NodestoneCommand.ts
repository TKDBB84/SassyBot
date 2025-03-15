import { Message } from 'discord.js';
import SassybotCommand from './SassybotCommand';
import { CoTAPIId } from '../../consts';
import fetch from 'node-fetch';

interface IFreeCompanyMember {
  Avatar: string;
  ID: number;
  Name: string;
  FcRank: string;
  Rank: 'MEMBER' | 'RECRUIT' | 'VETERAN' | 'OFFICER';
  RankIcon: string;
  exactRecruit: boolean;
}

interface NodeStoneResponse {
  FreeCompanyMembers: {
    List: IFreeCompanyMember[];
    Pagination: {
      PageNext: number;
      PageTotal: number;
    };
  };
}

export default class NodestoneCommand extends SassybotCommand {
  public readonly commands = ['nodestone'];

  public getHelpText(): string {
    return 'usage: `!{sassybot|sb} nodestone` -- test nodestone connectivity';
  }

  protected async listener({ message }: { message: Message }): Promise<void> {
    const url = `http://Nodestone:8080/freecompany/${CoTAPIId}?data=FCM&page=1`;
    await fetch(url)
      .then((res) => {
        if (res.ok) {
          return res.json();
        }
        throw new Error(`${res.status} ${res.statusText}`);
      })
      .then(async (json: NodeStoneResponse) => {
        await message.channel.send({
          content: JSON.stringify(json),
          reply: { messageReference: message },
        });
      })
      .catch((e) => {
        this.sb.logger.error(e);
      });
  }
}
