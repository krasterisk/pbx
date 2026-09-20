"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.NullAccountingProvider = void 0;
const common_1 = require("@nestjs/common");
const accounting_provider_abstract_1 = require("../accounting-provider.abstract");
/**
 * NullAccountingProvider — заглушка для случаев, когда бухгалтерская
 * интеграция отключена (accounting.provider = "none" в cloud_settings).
 * Метод createClosingDocument() ничего не делает и возвращает пустой результат.
 */
let NullAccountingProvider = class NullAccountingProvider extends accounting_provider_abstract_1.AccountingProvider {
    name = 'Не используется';
    isAvailable() {
        return false;
    }
    async createClosingDocument(_params) {
        return { docId: '', docUrl: '', docNumber: '' };
    }
    async getDocumentStatus(_docId) {
        return 'disabled';
    }
};
exports.NullAccountingProvider = NullAccountingProvider;
exports.NullAccountingProvider = NullAccountingProvider = __decorate([
    (0, common_1.Injectable)()
], NullAccountingProvider);
//# sourceMappingURL=null-accounting.provider.js.map