"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var SbisAccountingProvider_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.SbisAccountingProvider = void 0;
const common_1 = require("@nestjs/common");
const axios_1 = require("@nestjs/axios");
const rxjs_1 = require("rxjs");
const fast_xml_parser_1 = require("fast-xml-parser");
const accounting_provider_abstract_1 = require("../accounting-provider.abstract");
let SbisAccountingProvider = SbisAccountingProvider_1 = class SbisAccountingProvider extends accounting_provider_abstract_1.AccountingProvider {
    httpService;
    name = 'СБИС';
    logger = new common_1.Logger(SbisAccountingProvider_1.name);
    sessionToken = null;
    tokenExpiry = null;
    xmlBuilder = new fast_xml_parser_1.XMLBuilder({
        ignoreAttributes: false,
        attributeNamePrefix: '_',
        indentBy: '  ',
        format: true,
        attributeValueProcessor: (_attrName, attrValue) => String(attrValue),
    });
    constructor(httpService) {
        super();
        this.httpService = httpService;
    }
    isAvailable() {
        return !!(process.env.SBIS_LOGIN &&
            process.env.SBIS_PASS &&
            process.env.SBIS_ACC);
    }
    // ─── Session management ─────────────────────────────────────────────────────
    async getSession() {
        if (this.sessionToken && this.tokenExpiry && this.tokenExpiry > new Date()) {
            return this.sessionToken;
        }
        this.sessionToken = await this.auth();
        this.tokenExpiry = new Date(Date.now() + 23 * 60 * 60 * 1000); // 23 часа
        return this.sessionToken;
    }
    async auth() {
        const body = {
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
        const res = await (0, rxjs_1.firstValueFrom)(this.httpService.post('https://online.sbis.ru/auth/service/', body, {
            headers: { 'Content-Type': 'application/json-rpc;charset=utf-8' },
        }));
        this.logger.log('[SBIS] Authenticated successfully');
        return res.data.result;
    }
    async post(method, params, session) {
        const body = { jsonrpc: '2.0', method, params, id: 0 };
        return (0, rxjs_1.firstValueFrom)(this.httpService.post('https://online.sbis.ru/service/?srv=1', body, {
            headers: {
                'Content-Type': 'application/json-rpc;charset=utf-8',
                'X-SBISSessionID': session,
            },
        }));
    }
    // ─── AccountingProvider implementation ─────────────────────────────────────
    async createClosingDocument(params) {
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
        const writeRes = await this.post('СБИС.ЗаписатьДокумент', writeDocPayload, session);
        const docData = writeRes.data?.result;
        if (!docData) {
            throw new Error('[SBIS] СБИС.ЗаписатьДокумент returned empty result');
        }
        const sbisId = docData.Идентификатор;
        const sbisDocNum = docData.Номер;
        const sbisUrl = docData.СсылкаДляНашаОрганизация;
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
    async getDocumentStatus(docId) {
        const session = await this.getSession();
        const res = await this.post('СБИС.ПрочитатьДокумент', {
            Документ: { Идентификатор: docId },
        }, session);
        return res.data?.result?.Статус ?? 'unknown';
    }
    // ─── XML builder ────────────────────────────────────────────────────────────
    buildXmlDoc(params, docNum) {
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
                                    _КПП: process.env.OOO_KPP ?? '',
                                    _НаимОрг: process.env.OOO_NAME ?? 'KrAsterisk Cloud',
                                },
                            },
                        },
                        Сторона2: {
                            ИдСв: {
                                СвЮЛ: {
                                    _ИННЮЛ: params.payerInn,
                                    _КПП: params.payerKpp ?? '',
                                    _НаимОрг: params.payerName,
                                },
                            },
                        },
                    },
                    Таблица: {
                        _СтоимВсего: params.amountRub,
                        СведТабл: [{
                                _КодПП: params.serviceCode ?? process.env.SBIS_PBX_SUBJECT_CODE ?? '26',
                                _КолПП: '1',
                                _НаимПП: params.serviceDescription ?? process.env.SBIS_PBX_SUBJECT ?? 'Услуги облачной телефонии',
                                _НалСт: 'без НДС',
                                _Стоим: params.amountRub,
                                _СтоимБезНДС: params.amountRub,
                                _Цена: params.amountRub,
                            }],
                    },
                },
            },
        };
    }
};
exports.SbisAccountingProvider = SbisAccountingProvider;
exports.SbisAccountingProvider = SbisAccountingProvider = SbisAccountingProvider_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [axios_1.HttpService])
], SbisAccountingProvider);
//# sourceMappingURL=sbis-accounting.provider.js.map