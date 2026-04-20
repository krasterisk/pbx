import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios from 'axios';

@Injectable()
export class SmsService {
  private readonly logger = new Logger(SmsService.name);

  constructor(private configService: ConfigService) {}

  /**
   * Отправить СМС через API Beeline A2P
   */
  async sendSms(phone: string, message: string): Promise<{ success: boolean; smsId?: string }> {
    const token = this.configService.get<string>('SMS_BEELINE_TOKEN');
    
    if (!token) {
      this.logger.error('SMS_BEELINE_TOKEN is not configured in environment variables');
      return { success: false };
    }

    try {
      // Пример: "target": "+79231122334"
      // Если телефон начинается с 8, заменяем на +7 для корректной отправки
      let formattedPhone = phone;
      if (formattedPhone.startsWith('8') && formattedPhone.length === 11) {
        formattedPhone = '+7' + formattedPhone.slice(1);
      } else if (!formattedPhone.startsWith('+')) {
        formattedPhone = '+' + formattedPhone;
      }

      this.logger.log(`Sending SMS to ${formattedPhone} with payload: ${message}`);
      
      const response = await axios.post(
        'https://a2p-sms-https.beeline.ru/proto/http/rest',
        {
          action: 'post_sms',
          message: message,
          target: formattedPhone,
        },
        {
          headers: {
            'X-ApiKey': token,
          },
          timeout: 10000,
        },
      );
      
      // Пытаемся извлечь ID сообщения из ответа
      const smsId = response.data?.sms_id || response.data?.result?.sms_id || response.data?.id;
      this.logger.log(`SMS successfully sent to ${formattedPhone}. Status: ${response.status}, SMS ID: ${smsId}`);
      return { success: true, smsId };
    } catch (error: any) {
      this.logger.error(`Failed to send SMS to ${phone}: ${error.message}`);
      if (error.response?.data) {
        this.logger.error(`Response data: ${JSON.stringify(error.response.data)}`);
      }
      return { success: false };
    }
  }

  /**
   * Проверить статус СМС
   */
  async checkStatus(smsId: string): Promise<any> {
    const token = this.configService.get<string>('SMS_BEELINE_TOKEN');
    if (!token) {
      this.logger.error('SMS_BEELINE_TOKEN is not configured');
      return null;
    }

    try {
      const response = await axios.post(
        'https://a2p-sms-https.beeline.ru/proto/http/rest',
        {
          action: 'status',
          sms_id: smsId,
        },
        {
          headers: { 'X-ApiKey': token },
          timeout: 10000,
        },
      );
      
      this.logger.debug(`SMS Status [${smsId}]: ${JSON.stringify(response.data)}`);
      return response.data;
    } catch (error: any) {
      this.logger.error(`Failed to check SMS status [${smsId}]: ${error.message}`);
      return null;
    }
  }
}
