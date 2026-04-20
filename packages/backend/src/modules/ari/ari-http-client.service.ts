import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios, { AxiosInstance, AxiosError } from 'axios';

/**
 * Compact error thrown by ARI HTTP requests.
 * Strips Axios internals (TLS sockets, buffers) to keep logs readable.
 */
export class AriRequestError extends Error {
  constructor(
    public readonly method: string,
    public readonly url: string,
    public readonly status: number | null,
    public readonly responseBody: any,
    public readonly originalMessage: string,
  ) {
    const statusStr = status ? ` ${status}` : '';
    super(`ARI ${method.toUpperCase()}${statusStr} ${url}: ${originalMessage}`);
    this.name = 'AriRequestError';
  }
}

export interface AriEvent {
  type: string;
  [key: string]: any;
}

export interface Bridge {
  id: string;
  bridge_type: string;
  bridge_class: string;
  creator: string;
  name: string;
  channels: string[];
  technology: string;
  creationtime: string;
}

export interface Channel {
  id: string;
  name: string;
  state: string;
  caller: {
    name: string;
    number: string;
  };
  connected: {
    name: string;
    number: string;
  };
  creationtime: string;
  language: string;
  accountcode: string;
  peer: string;
  dialplan: {
    context: string;
    exten: string;
    priority: number;
    app_name: string;
    app_data: string;
  };
  channelvars?: any;
}

@Injectable()
export class AriHttpClientService implements OnModuleInit {
  private readonly logger = new Logger(AriHttpClientService.name);
  private client: AxiosInstance;
  private baseURL: string;
  private appName: string;

  constructor(private readonly configService: ConfigService) {}

  onModuleInit() {
    const protocol = this.configService.get<string>('ARI_PROTOCOL', 'http');
    const host = this.configService.get<string>('ARI_HOST', 'localhost');
    const port = this.configService.get<number>('ARI_PORT', 8088);
    const username = this.configService.get<string>('ARI_USER', 'krasterisk');
    const password = this.configService.get<string>('ARI_PASSWORD', '');
    
    this.baseURL = `${protocol}://${host}:${port}/ari`;
    this.appName = 'krasterisk_voicerobots'; // Can be fetched from config or dynamic

    this.client = axios.create({
      baseURL: this.baseURL,
      auth: { username, password },
      headers: {
        'Content-Type': 'application/json',
      },
      timeout: 10000,
    });

    // ─── Compact error interceptor ───
    // Strips Axios internals (TLS sockets, Buffers, circular refs)
    // so error logs stay readable instead of dumping megabytes.
    this.client.interceptors.response.use(
      (response) => response,
      (error: AxiosError) => {
        const method = error.config?.method || 'UNKNOWN';
        const url = error.config?.url || 'unknown';
        const status = error.response?.status ?? null;
        const body = error.response?.data;
        const msg = error.message || 'Unknown error';
        return Promise.reject(new AriRequestError(method, url, status, body, msg));
      },
    );

    this.logger.log(`Initialized ARI HTTP Client (baseURL: ${this.baseURL}, app: ${this.appName})`);
  }

  // ==================== Connection Test ====================
  async testConnection(): Promise<boolean> {
    try {
      const response = await this.client.get('/asterisk/info');
      return response.status === 200;
    } catch (error: any) {
      this.logger.error(`ARI connection test failed: ${error.message}`);
      return false;
    }
  }

  // ==================== Bridge Operations ====================
  async createBridge(type: string = 'mixing'): Promise<Bridge> {
    const response = await this.client.post('/bridges', undefined, { params: { type } });
    return response.data;
  }

  async addChannelToBridge(bridgeId: string, channelId: string): Promise<void> {
    await this.client.post(`/bridges/${bridgeId}/addChannel`, undefined, {
      params: { channel: channelId },
    });
  }

  async removeChannelFromBridge(bridgeId: string, channelId: string): Promise<void> {
    await this.client.post(`/bridges/${bridgeId}/removeChannel`, undefined, {
      params: { channel: channelId },
    });
  }

  async destroyBridge(bridgeId: string): Promise<void> {
    await this.client.delete(`/bridges/${bridgeId}`);
  }

  async getBridge(bridgeId: string): Promise<Bridge> {
    const response = await this.client.get(`/bridges/${bridgeId}`);
    return response.data;
  }

  async snoopChannel(
    channelId: string,
    app: string,
    appArgs: string,
    spy: 'none' | 'in' | 'out' | 'both' = 'none',
    whisper: 'none' | 'in' | 'out' | 'both' = 'out',
  ): Promise<Channel> {
    const response = await this.client.post(`/channels/${channelId}/snoop`, undefined, {
      params: { app, appArgs, spy, whisper },
    });
    return response.data;
  }

  // ==================== Channel Operations ====================
  async createChannel(endpoint: string, app: string, appArgs?: string): Promise<Channel> {
    const response = await this.client.post('/channels/create', undefined, {
      params: { endpoint, app, appArgs: appArgs || '' },
    });
    return response.data;
  }

  async continueChannel(channelId: string): Promise<void> {
    await this.client.post(`/channels/${channelId}/continue`);
  }

  async continueInDialplan(channelId: string, context?: string, extension?: string, priority?: number): Promise<void> {
    const params: any = {};
    if (context) params.context = context;
    if (extension) params.extension = extension;
    if (priority) params.priority = priority;

    const target = context ? `${extension}@${context}:${priority}` : '(default dialplan)';
    this.logger.debug(`[ARI] continueInDialplan channel=${channelId} → ${target}`);

    try {
      await this.client.post(`/channels/${channelId}/continue`, undefined, { params });
    } catch (e: any) {
      this.logger.error(`[ARI] continueInDialplan FAILED: ${e.message}`);
      throw e;
    }
  }

  async setChannelVar(channelId: string, variable: string, value: string): Promise<void> {
    await this.client.post(`/channels/${channelId}/variable`, undefined, {
      params: { variable, value },
    });
  }

  async answerChannel(channelId: string): Promise<void> {
    await this.client.post(`/channels/${channelId}/answer`);
  }

  async hangupChannel(channelId: string, reason: string = 'normal'): Promise<void> {
    await this.client.delete(`/channels/${channelId}`, { params: { reason } });
  }

  async getChannel(channelId: string): Promise<Channel> {
    const response = await this.client.get(`/channels/${channelId}`);
    return response.data;
  }

  async redirectChannel(channelId: string, context: string, extension: string, priority: number = 1): Promise<void> {
    await this.client.post(`/channels/${channelId}/redirect`, undefined, {
      params: { context, extension, priority },
    });
  }

  async playMedia(channelId: string, media: string, lang: string = 'ru'): Promise<string> {
    const response = await this.client.post(`/channels/${channelId}/play`, undefined, {
      params: { media: `sound:${media}`, lang },
    });
    return response.data.id;
  }

  async stopPlayback(playbackId: string): Promise<void> {
    await this.client.delete(`/playbacks/${playbackId}`);
  }

  // ==================== External Media ====================
  /**
   * Create an ExternalMedia channel for RTP streaming.
   *
   * @param channelId - Optional ID for the new channel (null = Asterisk assigns UUID)
   * @param app - Stasis application name
   * @param externalHost - Host:port where Asterisk sends RTP (e.g. '127.0.0.1:12000')
   * @param format - Audio format ('alaw', 'ulaw', 'slin16')
   * @param data - Optional metadata passed as args to StasisStart (e.g. parent channelId)
   */
  async externalMedia(
    channelId: string | null,
    app: string,
    externalHost: string,
    format: string = 'alaw',
    data?: string,
  ): Promise<Channel> {
    const params: any = {
      app,
      external_host: externalHost,
      format,
    };
    if (channelId) params.channelId = channelId;
    if (data) params.data = data;

    const response = await this.client.post(`/channels/externalMedia`, undefined, { params });
    return response.data;
  }

  // ==================== Utility Methods ====================
  async getAsteriskInfo(): Promise<any> {
    const response = await this.client.get('/asterisk/info');
    return response.data;
  }

  getBaseUrl(): string {
    return this.baseURL;
  }

  getAppName(): string {
    return this.appName;
  }
}
