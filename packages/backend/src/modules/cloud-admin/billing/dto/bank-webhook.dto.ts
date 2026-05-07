import { IsString, IsNotEmpty, IsOptional, IsNumberString } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class BankWebhookDto {
  @ApiProperty({ description: 'Уникальный ID транзакции банка (для дедупликации)' })
  @IsString()
  @IsNotEmpty()
  transactionId: string;

  @ApiProperty({ description: 'Сумма в рублях (строка)', example: '5000.00' })
  @IsNumberString()
  amount: string;

  @ApiProperty({ description: 'ИНН плательщика' })
  @IsString()
  @IsNotEmpty()
  payerInn: string;

  @ApiProperty({ description: 'Наименование плательщика' })
  @IsString()
  @IsNotEmpty()
  payerName: string;

  @ApiProperty({ description: 'Назначение платежа', required: false })
  @IsString()
  @IsOptional()
  paymentPurpose?: string;

  @ApiProperty({ description: 'Дата документа ISO', required: false })
  @IsString()
  @IsOptional()
  documentDate?: string;

  @ApiProperty({ description: 'ID организации (банковского аккаунта)', required: false })
  @IsString()
  @IsOptional()
  organizationId?: string;
}
