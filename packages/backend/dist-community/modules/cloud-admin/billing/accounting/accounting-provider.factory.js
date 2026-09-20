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
var AccountingProviderFactory_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.AccountingProviderFactory = void 0;
const common_1 = require("@nestjs/common");
const sbis_accounting_provider_1 = require("./providers/sbis-accounting.provider");
const null_accounting_provider_1 = require("./providers/null-accounting.provider");
/**
 * AccountingProviderFactory — selects the active accounting integration
 * based on environment configuration (ACCOUNTING_PROVIDER env var).
 *
 * Supported values:
 *   sbis  → СБИС онлайн
 *   none  → No-op provider (default)
 */
let AccountingProviderFactory = AccountingProviderFactory_1 = class AccountingProviderFactory {
    sbis;
    nullProvider;
    logger = new common_1.Logger(AccountingProviderFactory_1.name);
    active;
    constructor(sbis, nullProvider) {
        this.sbis = sbis;
        this.nullProvider = nullProvider;
        const configured = (process.env.ACCOUNTING_PROVIDER ?? 'none').toLowerCase();
        switch (configured) {
            case 'sbis':
                if (this.sbis.isAvailable()) {
                    this.active = this.sbis;
                    this.logger.log('Accounting provider: СБИС');
                }
                else {
                    this.logger.warn('SBIS selected but env vars are missing — falling back to NullProvider');
                    this.active = this.nullProvider;
                }
                break;
            default:
                this.active = this.nullProvider;
                this.logger.log('Accounting provider: None (disabled)');
        }
    }
    getProvider() {
        return this.active;
    }
};
exports.AccountingProviderFactory = AccountingProviderFactory;
exports.AccountingProviderFactory = AccountingProviderFactory = AccountingProviderFactory_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [sbis_accounting_provider_1.SbisAccountingProvider,
        null_accounting_provider_1.NullAccountingProvider])
], AccountingProviderFactory);
//# sourceMappingURL=accounting-provider.factory.js.map