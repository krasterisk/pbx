import { Injectable } from '@nestjs/common';
import {
  AccountingProvider,
  CreateDocumentParams,
  CreateDocumentResult,
} from '../accounting-provider.abstract';

/**
 * NullAccountingProvider — заглушка для случаев, когда бухгалтерская
 * интеграция отключена (accounting.provider = "none" в cloud_settings).
 * Метод createClosingDocument() ничего не делает и возвращает пустой результат.
 */
@Injectable()
export class NullAccountingProvider extends AccountingProvider {
  readonly name = 'Не используется';

  isAvailable(): boolean {
    return false;
  }

  async createClosingDocument(_params: CreateDocumentParams): Promise<CreateDocumentResult> {
    return { docId: '', docUrl: '', docNumber: '' };
  }

  async getDocumentStatus(_docId: string): Promise<string> {
    return 'disabled';
  }
}
