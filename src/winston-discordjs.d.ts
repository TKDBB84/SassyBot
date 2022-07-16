declare module 'winston-discordjs' {
  import type Transport from 'winston-transport';
  import type { Client, TextChannel, BitFieldResolvable, IntentsString } from 'discord.js';

  export interface DiscordTransportStreamOptions extends Transport.TransportStreamOptions {
    discordClient?: Client;
    discordToken?: string;
    discordChannel?: string | TextChannel;
    intents?: BitFieldResolvable<IntentsString, number>;
  }

  export default class DiscordTransport extends Transport {
    constructor({ discordClient, discordToken, discordChannel, intents }: DiscordTransportStreamOptions);
  }
}
