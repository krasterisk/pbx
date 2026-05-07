import { Injectable, Logger } from '@nestjs/common';
import { SbisAccountingProvider } from './providers/sbis-accounting.provider';
import { NullAccountingProvider } from './providers/null-accounting.provider';
import type { AccountingProvider } from './accounting-provider.abstract';

/**
 * AccountingProviderFactory — selects the active accounting integration
 * based on environment configuration (ACCOUNTING_PROVIDER env var).
 *
 * Supported values:
 *   sbis  → СБИС онлайн
 *   none  → No-op provider (default)
 */
@Injectable()
export class AccountingProviderFactory {
  private readonly logger = new Logger(AccountingProviderFactory.name);
  private readonly active: AccountingProvider;

  constructor(
    private readonly sbis: SbisAccountingProvider,
    private readonly nullProvider: NullAccountingProvider,
  ) {
    const configured = (process.env.ACCOUNTING_PROVIDER ?? 'none').toLowerCase();

    switch (configured) {
      case 'sbis':
        if (this.sbis.isAvailable()) {
          this.active = this.sbis;
          this.logger.log('Accounting provider: СБИС');
        } else {
          this.logger.warn('SBIS selected but env vars are missing — falling back to NullProvider');
          this.active = this.nullProvider;
        }
        break;
      default:
        this.active = this.nullProvider;
        this.logger.log('Accounting provider: None (disabled)');
    }
  }

  getProvider(): AccountingProvider {
    return this.active;
  }
}
