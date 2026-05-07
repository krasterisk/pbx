import {
  Controller, Post, Body, Headers, UnauthorizedException, HttpCode,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiHeader } from '@nestjs/swagger';
import { BankWebhookService } from './bank-webhook.service';
import { BankWebhookDto } from './dto/bank-webhook.dto';

/**
 * BankWebhookController — принимает уведомления о входящих платежах.
 *
 * Используется двумя способами:
 *   1. alfawebhook вызывает этот endpoint после получения транзакции от Альфа-Банка
 *      (через PBX_API_KEY env в alfawebhook)
 *   2. В будущем: напрямую от банка (при перенастройке webhook URL)
 *
 * Защита: Bearer token из env BANK_WEBHOOK_SECRET
 */
@ApiTags('Billing — Bank Webhook')
@Controller('billing/bank-webhook')
export class BankWebhookController {
  constructor(private readonly webhookService: BankWebhookService) {}

  @Post()
  @HttpCode(200)
  @ApiOperation({ summary: 'Принять уведомление о входящем платеже от банка' })
  @ApiHeader({ name: 'Authorization', description: 'Bearer <BANK_WEBHOOK_SECRET>' })
  async handleBankPayment(
    @Headers('authorization') authHeader: string,
    @Body() dto: BankWebhookDto,
  ) {
    const secret = process.env.BANK_WEBHOOK_SECRET;
    if (secret) {
      const token = authHeader?.replace('Bearer ', '').trim();
      if (token !== secret) {
        throw new UnauthorizedException('Invalid webhook secret');
      }
    }

    return this.webhookService.processPayment(dto);
  }
}
