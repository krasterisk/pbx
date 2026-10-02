import { Injectable, Logger } from '@nestjs/common';
import TelegramBot = require('node-telegram-bot-api');
import { ConfigService } from '@nestjs/config';

const TRANSIENT_CODES = new Set(['ECONNRESET', 'ETIMEDOUT', 'ECONNREFUSED', 'EAI_AGAIN', 'EFATAL']);
const RETRY_DELAYS_MS = [200, 800];

export function sanitizeTelegramError(error: unknown): string {
  const raw = error instanceof Error ? `${error.name}: ${error.message}` : String(error);
  return raw
    .replace(/bot\d+:[A-Za-z0-9_-]+/g, 'bot[redacted]')
    .replace(/https:\/\/api\.telegram\.org\/\S+/gi, 'https://api.telegram.org/[redacted]')
    .slice(0, 300);
}

function errorCode(error: unknown): string {
  let current: unknown = error;
  for (let depth = 0; depth < 5 && current && typeof current === 'object'; depth += 1) {
    const rec = current as { code?: unknown; cause?: unknown; error?: unknown };
    if (typeof rec.code === 'string' && rec.code !== 'EFATAL') return rec.code;
    current = rec.cause ?? rec.error;
  }
  const rec = error as { code?: unknown };
  return typeof rec?.code === 'string' ? rec.code : '';
}

function isTransient(error: unknown): boolean {
  const code = errorCode(error);
  return TRANSIENT_CODES.has(code) || /ECONNRESET|ETIMEDOUT|ECONNREFUSED/i.test(sanitizeTelegramError(error));
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

@Injectable()
export class TelegramService {
  private bot: TelegramBot | null = null;
  private readonly logger = new Logger(TelegramService.name);
  private chatId: string | undefined;

  constructor(private readonly configService: ConfigService) {
    const token = this.configService.get<string>('TELEGRAM_BOT_TOKEN');
    this.chatId = this.configService.get<string>('TELEGRAM_CHAT_ID');

    if (token) {
      try {
        this.bot = new TelegramBot(token, { polling: false });
        this.logger.log('Telegram bot instantiated');
      } catch (e) {
        this.logger.error(`Failed to initialize Telegram bot: ${sanitizeTelegramError(e)}`);
      }
    } else {
      this.logger.warn('TELEGRAM_BOT_TOKEN is not set. Telegram features will be disabled.');
    }
  }

  /**
   * Read-only channel presence for the AI adapter. Never returns the token (T-15-77).
   */
  async getChannelStatus(_vpbxUserUid: number): Promise<{ configured: boolean; enabled: boolean }> {
    const configured = this.bot !== null;
    return { configured, enabled: configured && Boolean(this.chatId) };
  }

  /**
   * Tenant-scoped delivery history. No store exists yet — empty until a log is added.
   */
  async listDeliveries(_vpbxUserUid: number): Promise<Array<{ id: string; status: string; timestamp: string }>> {
    return [];
  }

  async sendMessage(message: string, options?: TelegramBot.SendMessageOptions) {
    if (!this.bot) {
      return;
    }
    if (!this.chatId) {
      this.logger.warn('TELEGRAM_CHAT_ID is not set. Cannot send message to admin group.');
      return;
    }

    let lastError: unknown;
    for (let attempt = 0; attempt <= RETRY_DELAYS_MS.length; attempt += 1) {
      try {
        await this.bot.sendMessage(this.chatId, message, options);
        return;
      } catch (e) {
        lastError = e;
        if (attempt < RETRY_DELAYS_MS.length && isTransient(e)) {
          await sleep(RETRY_DELAYS_MS[attempt]);
          continue;
        }
        break;
      }
    }
    this.logger.warn(`Telegram send skipped: ${errorCode(lastError) || 'error'} ${sanitizeTelegramError(lastError)}`);
  }
}
