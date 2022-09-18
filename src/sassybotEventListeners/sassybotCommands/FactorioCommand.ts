import { Message } from 'discord.js';
import { ISassybotCommandParams } from '../../Sassybot';
import SassybotCommand from './SassybotCommand';
import fetch from 'node-fetch';
import { UserIds } from '../../consts';

const defaultHeaders = {
  Accept: 'application/json, text/plain, */*',
  'Accept-Language': 'en-US,en;q=0.5',
  'Accept-Encoding': 'gzip, deflate, br',
  'Alt-Used': 'hostfactor.io',
  Connection: 'keep-alive',
  'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10.15; rv:103.0) Gecko/20100101 Firefox/103.0',
  'Sec-Fetch-Dest': 'empty',
  'Sec-Fetch-Mode': 'cors',
  'Sec-Fetch-Site': 'same-origin',
  Pragma: 'no-cache',
  'Cache-Control': 'no-cache',
  TE: 'trailers',
};

declare type hostFactorLoginResponse = {
  auth_packet: {
    id: string;
    email: string;
    token: string;
  };
};

declare type jwtType = {
  exp: number;
};

declare type hostFactorStats = {
  recent: {
    memory: { unit: number; resource: { usage: number; limit: number } };
    cpu: { unit: number; resource: { usage: number } };
    timestamp: number;
  };
};

declare type hostFactorLocation = { bucket_file: { name: string; folder: string } };

declare type hostFactorFile = {
  name: string;
  byte_size: string;
  mime: string;
  created: string;
  location: hostFactorLocation;
};

declare type hostFactorVolume = {
  name: string;
  source: {
    file_input: {
      accept_props: Array<string>;
      help_text: string;
      destination: {
        bucket_folder: string;
      };
      description: string;
      title: string;
      on: Array<string>;
    };
  };
  mount: {
    path: string;
  };
};

declare type hostFactorVolumes = {
  volume: hostFactorVolume;
  files: Array<hostFactorFile>;
  selected_file_names: Array<string>;
};

declare type hostFactorVolumeResponse = {
  disk: {
    instance_name: string;
    title: string;
    instance_id: string;
    volumes: Array<hostFactorVolumes>;
  };
};

declare type hostFactorInstance = {
  status: { phase: number; message: string; details: string };
  inter: { port: number; host: string; protocol: number };
  meta: {
    id: string;
    user_id: string;
    mb_of_ram: number;
    created_at: { seconds: number; nanos: number };
    in_phase: { seconds: number; nanos: number };
    title_name: string;
  };
  title: {
    min_mb: number;
    name: string;
    title: string;
    thumbnail: string;
    description: string;
    store_link: string;
    site_link: string;
  };
  subscription: { id: string; status: number; expires: number };
  region: { name: string; country: string; city: string };
  memory: { name: string; mb: number };
  name: string;
  endpoint_type: number;
  mode_type: number;
};
declare type hostFactorInstanceResponse = {
  instances: Array<hostFactorInstance>;
};

export default class FactorioCommand extends SassybotCommand {
  public readonly commands = ['factorio'];

  public getHelpText(): string {
    return 'usage: `!{sassybot|sb} factorio [start]` -- I reply with the status of the server, or start it for you';
  }

  protected async listener({ message, params }: { message: Message; params: ISassybotCommandParams }): Promise<void> {
    const hostFactorJWT = await this.getAuthToken();
    const instance = await this.getInstance(hostFactorJWT);
    const instanceName = instance.name;
    let currentStatus = instance.status.message;
    const connectionString = `${instance.inter.host}:${instance.inter.port}`;
    const instanceId = instance.meta.id;
    const isReady = instance.status.message === 'Ready';
    const isStarting = instance.status.message === 'Starting';
    const isIdle = instance.status.message === 'Idle';

    if (isIdle && !isReady && !isStarting && params.args.toLowerCase().includes('start')) {
      const isStarting = await this.startServer(hostFactorJWT, instanceName, instanceId);
      if (isStarting) {
        await message.reply('Server Is Starting... This may take sometime.');
        currentStatus = 'Starting';
      }
    }

    if (isStarting && params.args.toLowerCase().includes('start')) {
      await message.reply('The Server is already starting, it may take some time.');
    }

    let replyStats = '';
    if (isReady) {
      const stats = await this.getStats(hostFactorJWT, instanceId);
      const cpuUsage = stats.recent.cpu.resource.usage;
      const memoryUsage = stats.recent.memory.resource.usage;
      const memoryMax = stats.recent.memory.resource.limit;
      const memoryPercent = `${((memoryUsage / memoryMax) * 100).toFixed(1)}%`;
      replyStats = `CPU: \`${cpuUsage}\` ¯\\_(ツ)_/¯\nMemory: \`${memoryUsage}/${memoryMax}\`MB (\`${memoryPercent}\`)`;
    }

    const allowedIds = [UserIds.YOAKE, UserIds.JIGGLYPENGUIN, UserIds.SASTRA, UserIds.SASNER].map((i) => i.toString());
    let replyMessage = `Server Status: \`${currentStatus}\`\n`;
    if (allowedIds.includes(message.author.id)) {
      replyMessage += `Connection String: \`${connectionString}\`\n`;
    }
    replyMessage += replyStats;
    await message.reply(replyMessage);
  }

  private async getAuthToken(): Promise<string> {
    const redis = await this.sb.getRedis();
    const { HOST_FACTOR_USERNAME = '', HOST_FACTOR_PASSWORD = '' } = process.env;

    const JWT_KEY = 'HOST_FACTOR_JWT';
    const hostFactorJWT: string | null = await redis.get(JWT_KEY);
    if (hostFactorJWT) {
      return hostFactorJWT;
    }

    const result = await fetch('https://hostfactor.io/v1/auth/login', {
      method: 'post',
      body: JSON.stringify({ email: HOST_FACTOR_USERNAME, password: HOST_FACTOR_PASSWORD }),
      headers: {
        'Content-Type': 'application/json;charset=utf-8',
        Origin: 'https://hostfactor.io',
        Referer: 'https://hostfactor.io/',
        ...defaultHeaders,
      },
    });
    if (result && result.ok) {
      let responseBody;
      try {
        responseBody = (await result.json()) as hostFactorLoginResponse;
      } catch (e) {
        this.sb.logger.error('Error Parsing HostFactor Response', { error: e, result });
        throw e;
      }
      if (responseBody && responseBody.auth_packet) {
        try {
          const { token: jwtString } = responseBody.auth_packet;
          const jwtPayload = jwtString.substring(jwtString.indexOf('.') + 1, jwtString.lastIndexOf('.'));
          const jwt = JSON.parse(Buffer.from(jwtPayload, 'base64').toString('utf-8')) as jwtType;
          const expTimestamp = jwt.exp;
          const currentTimestamp = Math.floor(Date.now() / 1000);
          const ttlForJWT = expTimestamp - currentTimestamp - 1000; // pull an extra 1000s off because why not
          await redis.setex(JWT_KEY, ttlForJWT, jwtString);
          return jwtString;
        } catch (e) {
          // sad day
          this.sb.logger.error('Error With JWT', { error: e, responseBody });
          throw e;
        }
      } else {
        this.sb.logger.error('Error Reading HostFactor Response', { responseBody });
        throw new Error('Error Reading HostFactor Response');
      }
    } else {
      this.sb.logger.error('Error Calling HostFactor', { result });
      throw new Error('Error Calling HostFactor');
    }
  }

  private async getInstance(hostFactorJWT: string): Promise<hostFactorInstance> {
    const instanceResult = await fetch('https://hostfactor.io/v1/instance', {
      method: 'get',
      headers: {
        Referer: 'https://hostfactor.io/dashboard',
        Cookie: `hostfactor_token=${hostFactorJWT}; hostfactor_marker_token=marker`,
        ...defaultHeaders,
      },
    });
    if (instanceResult && instanceResult.ok) {
      let instanceResponseBody;
      try {
        instanceResponseBody = (await instanceResult.json()) as hostFactorInstanceResponse;
      } catch (e) {
        this.sb.logger.error('Error Parsing HostFactor Response', { error: e, result: instanceResult });
        throw e;
      }
      if (instanceResponseBody && instanceResponseBody.instances) {
        const sasnersStupidInSpace = instanceResponseBody.instances.find(
          (instance) => instance && instance.name === 'Sasners-Stupid-In-Space',
        );
        if (sasnersStupidInSpace) {
          return sasnersStupidInSpace;
        }
        throw new Error('Could Not Find Matching Server');
      } else {
        this.sb.logger.error('Error Reading HostFactor Response', { responseBody: instanceResponseBody });
        throw new Error('Error Reading HostFactor Response');
      }
    } else {
      this.sb.logger.error('Error Calling HostFactor', { result: instanceResult });
      throw new Error('Error Calling HostFactor');
    }
  }

  private async getMostRecentSaveLocation(hostFactorJWT: string, instanceName: string): Promise<hostFactorLocation> {
    const diskResults = await fetch(`https://hostfactor.io/v1/disk?title=factorio&instance_name=${instanceName}`, {
      method: 'get',
      headers: {
        Referer: 'https://hostfactor.io/dashboard',
        Cookie: `hostfactor_token=${hostFactorJWT}; hostfactor_marker_token=marker`,
        ...defaultHeaders,
      },
    });
    if (diskResults && diskResults.ok) {
      let diskResponseBody;
      try {
        diskResponseBody = (await diskResults.json()) as hostFactorVolumeResponse;
      } catch (e) {
        this.sb.logger.error('Error Parsing HostFactor Response', { error: e, result: diskResults });
        throw e;
      }
      if (diskResponseBody && diskResponseBody.disk && diskResponseBody.disk.volumes) {
        const saveVolume = diskResponseBody.disk.volumes.find(
          (volume) => volume && volume.volume && volume.volume.name === 'save',
        );
        if (saveVolume && saveVolume.files) {
          const mostRecentCreated = saveVolume.files.reduce((max, i) => {
            const { created } = i;
            const createdNum = Number(created);
            if (createdNum > max) {
              return createdNum;
            }
            return max;
          }, -1);
          const mostRecentSave = saveVolume.files.find((file) => file.created === mostRecentCreated.toString());
          if (mostRecentSave && mostRecentSave.location) {
            return mostRecentSave.location;
          }
        }
        throw new Error('Could Not Find Matching Save Volume');
      } else {
        this.sb.logger.error('Error Reading HostFactor Response', { responseBody: diskResponseBody });
        throw new Error('Error Reading HostFactor Response');
      }
    } else {
      this.sb.logger.error('Error Calling HostFactor', { result: diskResults });
      throw new Error('Error Calling HostFactor');
    }
  }

  private async startServer(hostFactorJWT: string, instanceName: string, instanceId: string): Promise<true> {
    const location = this.getMostRecentSaveLocation(hostFactorJWT, instanceName);
    const result = await fetch(`https://hostfactor.io/v1/instance/${instanceId}/start`, {
      method: 'PUT',
      body: JSON.stringify({
        selected_files: [
          {
            volume_name: 'save',
            locations: [location],
          },
        ],
      }),
      headers: {
        'Content-Type': 'application/json;charset=utf-8',
        Origin: 'https://hostfactor.io',
        Referer: 'https://hostfactor.io/dashboard',
        Cookie: `hostfactor_token=${hostFactorJWT}; hostfactor_marker_token=marker`,
        ...defaultHeaders,
      },
    });
    if (result && result.ok) {
      return true;
    }
    this.sb.logger.error('Could Not Start Server', { result });
    throw new Error('Could Not Start Server');
  }

  private async getStats(hostFactorJWT: string, instanceId: string): Promise<hostFactorStats> {
    const statsResults = await fetch(`https://hostfactor.io/v1/metrics/${instanceId}`, {
      method: 'get',
      headers: {
        Referer: 'https://hostfactor.io/dashboard',
        Cookie: `hostfactor_token=${hostFactorJWT}; hostfactor_marker_token=marker`,
        ...defaultHeaders,
      },
    });
    if (statsResults && statsResults.ok) {
      let statsResponseBody;
      try {
        statsResponseBody = (await statsResults.json()) as hostFactorStats;
      } catch (e) {
        this.sb.logger.error('Error Parsing HostFactor Response', { error: e, result: statsResults });
        throw e;
      }
      return statsResponseBody;
    } else {
      this.sb.logger.error('Error Calling HostFactor', { result: statsResults });
      throw new Error('Error Calling HostFactor');
    }
  }
}
