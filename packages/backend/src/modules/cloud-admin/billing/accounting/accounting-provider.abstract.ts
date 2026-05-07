/**
 * AccountingProvider — стратегия для бухгалтерских интеграций.
 *
 * Текущие реализации:
 *   - SbisAccountingProvider  (СБИС онлайн)
 *   - NullAccountingProvider  (интеграция отключена)
 *
 * Будущие реализации (добавить новый файл в providers/):
 *   - KonturAccountingProvider  (Контур.Диадок)
 *   - OneCAccountingProvider    (1С ЭДО)
 */
export interface CreateDocumentParams {
  /** Сумма в рублях (строка, как приходит из банка) */
  amountRub: string;
  /** ИНН контрагента (клиента) */
  payerInn: string;
  /** КПП контрагента */
  payerKpp?: string;
  /** Наименование контрагента */
  payerName: string;
  /** Юридический адрес контрагента */
  payerAddress?: string;
  /** Дата операции ISO */
  documentDate: string;
  /** Внутренний номер документа (для сквозной нумерации) */
  docNumber: string;
  /** Наименование услуги (из cloud_settings или дефолт) */
  serviceDescription?: string;
  /** Код предмета расчёта (из cloud_settings) */
  serviceCode?: string;
}

export interface CreateDocumentResult {
  /** Идентификатор документа в системе провайдера */
  docId: string;
  /** Публичная ссылка на документ для клиента */
  docUrl: string;
  /** Номер документа в системе провайдера */
  docNumber?: string;
}

export abstract class AccountingProvider {
  /** Название провайдера для логов и UI */
  abstract readonly name: string;

  /** Проверить доступность провайдера (настроен ли, есть ли соединение) */
  abstract isAvailable(): boolean;

  /**
   * Создать закрывающий документ (акт) в системе провайдера.
   * @returns ссылка на документ и его идентификатор
   */
  abstract createClosingDocument(params: CreateDocumentParams): Promise<CreateDocumentResult>;

  /**
   * Получить статус документа по идентификатору.
   * @returns строковый статус (зависит от провайдера)
   */
  abstract getDocumentStatus(docId: string): Promise<string>;
}
