import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AmiService } from '../ami/ami.service';
import { DialplanSubroutinesUtil } from '../../shared/utils/dialplan-subroutines.util';

/**
 * Generates and applies the global Asterisk subroutines file via AMI UpdateConfig.
 *
 * File: krasterisk/subroutines/subroutines.conf
 * Auto-picked up by: #include krasterisk/*\/*.conf  (already in extensions.conf)
 *
 * Applied automatically on backend startup (onModuleInit + 5s delay for AMI connect).
 * Can be re-applied manually via POST /api/system-settings/apply-subroutines.
 *
 * Contents: [krsk-on-answer] + [krsk-hangup-handler]
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
    private readonly amiService: AmiService,
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

    // Parse content into individual dialplan lines for AMI
    // Strip comments and blank lines — AMI UpdateConfig doesn't support them
    const allLines = content.split('\n');
    const contexts: Array<{ name: string; lines: string[] }> = [];
    let currentContext: { name: string; lines: string[] } | null = null;

    for (const raw of allLines) {
      const line = raw.trim();
      if (!line || line.startsWith(';')) continue;

      const ctxMatch = line.match(/^\[([^\]]+)\]$/);
      if (ctxMatch) {
        if (currentContext) contexts.push(currentContext);
        currentContext = { name: ctxMatch[1], lines: [] };
      } else if (currentContext) {
        currentContext.lines.push(line);
      }
    }
    if (currentContext) contexts.push(currentContext);

    const file = DialplanSubroutinesService.SUBROUTINES_FILE;
    let totalLines = 0;

    for (const ctx of contexts) {
      // Delete existing category (ignore error if not exists)
      try {
        await this.amiService.action({
          action: 'UpdateConfig',
          srcfilename: file,
          dstfilename: file,
          reload: 'no',
          'Action-000000': 'DelCat',
          'Cat-000000': ctx.name,
        });
      } catch { /* expected if file/cat doesn't exist yet */ }

      // Create category
      await this.amiService.action({
        action: 'UpdateConfig',
        srcfilename: file,
        dstfilename: file,
        reload: 'no',
        'Action-000000': 'NewCat',
        'Cat-000000': ctx.name,
      });

      // Append lines in batches of 20 (AMI header limit)
      const BATCH = 20;
      for (let start = 0; start < ctx.lines.length; start += BATCH) {
        const batch = ctx.lines.slice(start, start + BATCH);
        const batchAction: Record<string, string> = {
          action: 'UpdateConfig',
          srcfilename: file,
          dstfilename: file,
          reload: 'no',
        };

        batch.forEach((line, idx) => {
          const pad = String(idx).padStart(6, '0');
          const arrowPos = line.indexOf('=>');
          if (arrowPos !== -1) {
            batchAction[`Action-${pad}`] = 'Append';
            batchAction[`Cat-${pad}`] = ctx.name;
            batchAction[`Var-${pad}`] = line.substring(0, arrowPos).trim();
            batchAction[`Value-${pad}`] = `> ${line.substring(arrowPos + 2).trim()}`;
          } else {
            const eqPos = line.indexOf('=');
            batchAction[`Action-${pad}`] = 'Append';
            batchAction[`Cat-${pad}`] = ctx.name;
            batchAction[`Var-${pad}`] = eqPos !== -1 ? line.substring(0, eqPos).trim() : line;
            batchAction[`Value-${pad}`] = eqPos !== -1 ? line.substring(eqPos + 1).trim() : '';
          }
        });

        await this.amiService.action(batchAction);
        totalLines += batch.length;
      }
    }

    // Reload dialplan so Asterisk picks up the new subroutines
    await this.amiService.command('dialplan reload');

    this.logger.log(`✅ Subroutines applied: ${file} (${totalLines} lines, ${contexts.length} contexts)`);
    return { success: true, linesApplied: totalLines };
  }
}
