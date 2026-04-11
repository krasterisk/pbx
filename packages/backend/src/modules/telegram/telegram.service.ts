import { Injectable, Logger } from '@nestjs/common';
import TelegramBot = require('node-telegram-bot-api');
import { ConfigService } from '@nestjs/config';

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
        this.logger.error('Failed to initialize Telegram bot', e);
      }
    } else {
      this.logger.warn('TELEGRAM_BOT_TOKEN is not set. Telegram features will be disabled.');
    }
  }

  async sendMessage(message: string, options?: TelegramBot.SendMessageOptions) {
    if (!this.bot) {
      return;
    }
    if (!this.chatId) {
      this.logger.warn('TELEGRAM_CHAT_ID is not set. Cannot send message to admin group.');
      return;
    }

    try {
      await this.bot.sendMessage(this.chatId, message, options);
    } catch (e) {
      this.logger.error('Failed to send telegram message', e);
    }
  }
}
