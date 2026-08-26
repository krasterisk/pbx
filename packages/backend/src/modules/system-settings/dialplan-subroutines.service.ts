import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DialplanApplyService } from '../ami/dialplan-apply.service';
import { DialplanSubroutinesUtil } from '../../shared/utils/dialplan-subroutines.util';

/**
 * Generates and applies the global Asterisk subroutines file via AMI UpdateConfig.
 *
 * File: krasterisk/subroutines/subroutines.conf
 * Auto-picked up by: #include krasterisk/*\/*.conf  (already in extensions.conf)
 *
 * Ops (once per stand): AMI CreateConfig cannot mkdir — ensure parent dirs exist:
 *   mkdir -p $AST_CONFIG_DIR/krasterisk/{groups,routes,phonebooks,subroutines,ivrs}
 *   && chown -R asterisk:asterisk $AST_CONFIG_DIR/krasterisk
 *
 * Applied automatically on backend startup (onModuleInit + 5s delay for AMI connect).
 * Can be re-applied manually via POST /api/system-settings/apply-subroutines.
 *
 * Contents: [krsk-on-answer] + [krsk-hangup-handler] + [krsk-click-to-call]
 */
@Injectable()
export class DialplanSubroutinesService implements OnModuleInit {
  private readonly logger = new Logger(DialplanSubroutinesService.name);

  /**
   * Path to the subroutines config file (relative to Asterisk config dir).
   *
   * extensions.conf uses: #include krasterisk/*\/*.conf
   * So the file MUST be TWO levels deep: krasterisk/{subdir}/{file}.conf
   * → krasterisk/subroutines/subroutines.conf ✅
   * → krasterisk/subroutines.conf             ❌ (not matched by glob)
   */
  static readonly SUBROUTINES_FILE = 'krasterisk/subroutines/subroutines.conf';


  constructor(
    private readonly dialplanApplyService: DialplanApplyService,
    private readonly config: ConfigService,
  ) {}

  async onModuleInit() {
    // Delay slightly to let AMI connection establish before writing
    setTimeout(() => this.applySubroutines().catch(() => {}), 5000);
  }

  /**
   * Generate subroutines content and write to Asterisk config via AMI UpdateConfig.
   * Safe to call multiple times — always overwrites previous content.
   */
  async applySubroutines(): Promise<{ success: boolean; linesApplied: number }> {
    const backendUrl = this.config.get<string>('DIALPLAN_BACKEND_URL')
      || `http://127.0.0.1:${this.config.get('BACKEND_PORT') || 5010}/api`;
    const apiKey = this.config.get<string>('DIALPLAN_API_KEY') || '';
    const recordsBase = this.config.get<string>('RECORDS_BASE_PATH') || '/usr/records';

    const content = DialplanSubroutinesUtil.generate(backendUrl, apiKey, recordsBase);
    const contexts = DialplanSubroutinesUtil.parseCategories(content);
    const file = DialplanSubroutinesService.SUBROUTINES_FILE;

    // A leftover [ctx] in the same file (failed DelCat) makes Asterisk merge
    // two copies of the same extension. Purge each name twice, then rewrite.
    const names = contexts.map((ctx) => ctx.name);
    await this.dialplanApplyService.deleteCategories(file, [...names, ...names], { reload: false });

    const result = await this.dialplanApplyService.applyCategories(file, contexts, { reload: true });

    this.logger.log(`✅ Subroutines applied: ${file} (${result.linesApplied} lines, ${contexts.length} contexts)`);
    return { success: result.success, linesApplied: result.linesApplied };
  }
}
