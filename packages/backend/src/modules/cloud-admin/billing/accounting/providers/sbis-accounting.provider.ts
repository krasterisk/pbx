import { Injectable, Logger } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';
import { XMLBuilder } from 'fast-xml-parser';
import {
  AccountingProvider,
  CreateDocumentParams,
  CreateDocumentResult,
} from '../accounting-provider.abstract';

interface SbisRpcRequest {
  jsonrpc: '2.0';
  method: string;
  params: any;
  id: number;
}

@Injectable()
export class SbisAccountingProvider extends AccountingProvider {
  readonly name = 'СБИС';

  private readonly logger = new Logger(SbisAccountingProvider.name);

  private sessionToken: string | null = null;
  private tokenExpiry: Date | null = null;

  private readonly xmlBuilder = new XMLBuilder({
    ignoreAttributes: false,
    attributeNamePrefix: '_',
    indentBy: '  ',
    format: true,
    attributeValueProcessor: (_attrName: string, attrValue: unknown) => String(attrValue),
  });

  constructor(private readonly httpService: HttpService) {
    super();
  }

  isAvailable(): boolean {
    return !!(
      process.env.SBIS_LOGIN &&
      process.env.SBIS_PASS &&
      process.env.SBIS_ACC
    );
  }

  // ─── Session management ─────────────────────────────────────────────────────

  private async getSession(): Promise<string> {
    if (this.sessionToken && this.tokenExpiry && this.tokenExpiry > new Date()) {
      return this.sessionToken;
    }
    this.sessionToken = await this.auth();
    this.tokenExpiry = new Date(Date.now() + 23 * 60 * 60 * 1000); // 23 часа
    return this.sessionToken;
  }

  private async auth(): Promise<string> {
    const body: SbisRpcRequest = {
      jsonrpc: '2.0',
      method: 'СБИС.Аутентифицировать',
      params: {
        Параметр: {
          Логин: process.env.SBIS_LOGIN,
          Пароль: process.env.SBIS_PASS,
          НомерАккаунта: process.env.SBIS_ACC,
        },
      },
      id: 0,
    };

    const res = await firstValueFrom(
      this.httpService.post('https://online.sbis.ru/auth/service/', body, {
        headers: { 'Content-Type': 'application/json-rpc;charset=utf-8' },
      }),
    ) as any;
    this.logger.log('[SBIS] Authenticated successfully');
    return res.data.result as string;
  }

  private async post(method: string, params: any, session: string): Promise<any> {
    const body: SbisRpcRequest = { jsonrpc: '2.0', method, params, id: 0 };
    return firstValueFrom(
      this.httpService.post('https://online.sbis.ru/service/?srv=1', body, {
        headers: {
          'Content-Type': 'application/json-rpc;charset=utf-8',
          'X-SBISSessionID': session,
        },
      }),
    );
  }

  // ─── AccountingProvider implementation ─────────────────────────────────────

  async createClosingDocument(params: CreateDocumentParams): Promise<CreateDocumentResult> {
    const session = await this.getSession();

    // 1. Создать документ
    const writeDocPayload = {
      Документ: {
        Тип: 'ДокОтгрИсх',
        Дата: params.documentDate.slice(0, 10),
        Примечание: 'Импортировано через API KrAsterisk',
        Сумма: params.amountRub,
        НашаОрганизация: {
          СвЮЛ: {
            ИНН: process.env.OOO_INN,
            КПП: process.env.OOO_KPP ?? '',
          },
        },
        Контрагент: {
          СвЮЛ: {
            ИННЮЛ: params.payerInn,
            КПП: params.payerKpp ?? '',
          },
        },
      },
    };

    const writeRes: any = await this.post('СБИС.ЗаписатьДокумент', writeDocPayload, session);
    const docData = writeRes.data?.result;

    if (!docData) {
      throw new Error('[SBIS] СБИС.ЗаписатьДокумент returned empty result');
    }

    const sbisId: string = docData.Идентификатор;
    const sbisDocNum: string = docData.Номер;
    const sbisUrl: string = docData.СсылкаДляНашаОрганизация;

    this.logger.log(`[SBIS] Document created: id=${sbisId}, num=${sbisDocNum}`);

    // 2. Сформировать XML вложение (УПД)
    const xmlDoc = this.buildXmlDoc(params, sbisDocNum);
    const xmlString = this.xmlBuilder.build(xmlDoc);
    const xmlBase64 = Buffer.from(xmlString).toString('base64');

    const fileName = `AKT_${params.payerInn}_${params.docNumber}.xml`;

    const attachPayload = {
      Документ: {
        Идентификатор: sbisId,
        Вложение: {
          Файл: {
            Имя: fileName,
            ДвоичныеДанные: xmlBase64,
          },
        },
      },
    };

    await this.post('СБИС.ЗаписатьВложение', attachPayload, session);
    this.logger.log(`[SBIS] Attachment uploaded: ${fileName}`);

    return {
      docId: sbisId,
      docUrl: sbisUrl,
      docNumber: sbisDocNum,
    };
  }

  async getDocumentStatus(docId: string): Promise<string> {
    const session = await this.getSession();
    const res: any = await this.post('СБИС.ПрочитатьДокумент', {
      Документ: { Идентификатор: docId },
    }, session);
    return res.data?.result?.Статус ?? 'unknown';
  }

  // ─── XML builder ────────────────────────────────────────────────────────────

  private buildXmlDoc(params: CreateDocumentParams, docNum: string) {
    const today = new Date().toLocaleDateString('ru-RU', {
      day: '2-digit', month: '2-digit', year: 'numeric',
    }).split('.').join('.');

    return {
      Файл: {
        _ВерсПрог: 'КрАстериск.Биллинг 1.0',
        _ВерсФорм: '1.01',
        Документ: {
          _ТипДокумента: '1',
          СведДок: {
            _НомерДок: docNum,
            _ДатаДок: today,
            Сторона1: {
              ИдСв: {
                СвЮЛ: {
                  _ИННЮЛ: process.env.OOO_INN ?? '',
                  _КПП:   process.env.OOO_KPP ?? '',
                  _НаимОрг: process.env.OOO_NAME ?? 'KrAsterisk Cloud',
                },
              },
            },
            Сторона2: {
              ИдСв: {
                СвЮЛ: {
                  _ИННЮЛ: params.payerInn,
                  _КПП:   params.payerKpp ?? '',
                  _НаимОрг: params.payerName,
                },
              },
            },
          },
          Таблица: {
            _СтоимВсего: params.amountRub,
            СведТабл: [{
              _КодПП:       params.serviceCode ?? process.env.SBIS_PBX_SUBJECT_CODE ?? '26',
              _КолПП:       '1',
              _НаимПП:      params.serviceDescription ?? process.env.SBIS_PBX_SUBJECT ?? 'Услуги облачной телефонии',
              _НалСт:       'без НДС',
              _Стоим:       params.amountRub,
              _СтоимБезНДС: params.amountRub,
              _Цена:        params.amountRub,
            }],
          },
        },
      },
    };
  }
}
