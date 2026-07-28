import { Injectable, Logger } from '@nestjs/common';
import { AmiService } from './ami.service';

/** One dialplan context/category to write: category name + its raw lines. */
export interface DialplanCategory {
  name: string;
  lines: string[];
}

export interface ApplyCategoriesOptions {
  /** Run `dialplan reload` once after all categories are applied. Default: true. */
  reload?: boolean;
}

export interface ApplyCategoriesResult {
  success: boolean;
  linesApplied: number;
}

const BATCH_SIZE = 20;

/** AMI CreateConfig O_CREAT|O_EXCL — file already present; UpdateConfig can proceed. */
function isCreateConfigFileExistsError(message: string): boolean {
  const m = message.toLowerCase();
  return (
    m.includes('already exists') ||
    m.includes('file exists') ||
    m.includes('eexist')
  );
}

/**
 * DialplanApplyService — единая точка применения dialplan-контекстов через AMI:
 * CreateConfig (ensure empty file) → UpdateConfig (DelCat → NewCat → Append батчами)
 * → опциональный dialplan reload.
 *
 * AMI CreateConfig cannot create parent directories — ops must mkdir
 * krasterisk/{groups,routes,phonebooks,subroutines,ivrs} under AST_CONFIG_DIR.
 *
 * Консолидирует батч-логику, ранее продублированную в routes.controller,
 * ai-webhook.controller, mcp-tools.service и dialplan-subroutines.service (D-22).
 *
 * Интерфейс — шов на будущий FS-writer (альтернативная реализация за env-флагом),
 * без изменения вызывающих.
 */
@Injectable()
export class DialplanApplyService {
  private readonly logger = new Logger(DialplanApplyService.name);

  constructor(private readonly amiService: AmiService) {}

  /**
   * Ensures the config file exists via AMI CreateConfig (empty file).
   * Idempotent when the file already exists; rethrows real failures
   * (missing parent dir / true privileges) before UpdateConfig.
   */
  private async ensureConfigFile(filename: string): Promise<void> {
    try {
      await this.amiService.action({
        action: 'CreateConfig',
        filename,
      });
    } catch (e: any) {
      const message = String(e?.message || e);
      if (isCreateConfigFileExistsError(message)) {
        return;
      }
      this.logger.error(`CreateConfig failed for ${filename}: ${message}`);
      throw e;
    }
  }

  /**
   * Applies one or more dialplan categories to a config file via AMI:
   * CreateConfig (ensure file) → UpdateConfig DelCat/NewCat/Append in the order given,
   * then optionally reloads the dialplan once at the end.
   */
  async applyCategories(
    filename: string,
    categories: DialplanCategory[],
    opts: ApplyCategoriesOptions = {},
  ): Promise<ApplyCategoriesResult> {
    await this.ensureConfigFile(filename);

    let totalLines = 0;

    for (const category of categories) {
      const lines = category.lines
        .map((l) => l.trim())
        .filter((l) => l && !l.startsWith('[') && !l.startsWith(';'));

      // Step 1: Delete existing category (silently fails if doesn't exist)
      try {
        await this.amiService.action({
          action: 'UpdateConfig',
          srcfilename: filename,
          dstfilename: filename,
          reload: 'no',
          'Action-000000': 'DelCat',
          'Cat-000000': category.name,
        });
      } catch (e) {
        // Expected: category or file doesn't exist yet
      }

      // Step 2: Create category
      try {
        await this.amiService.action({
          action: 'UpdateConfig',
          srcfilename: filename,
          dstfilename: filename,
          reload: 'no',
          'Action-000000': 'NewCat',
          'Cat-000000': category.name,
        });
      } catch (e: any) {
        this.logger.error(`Failed to create category [${category.name}]: ${e?.message || e}`);
        throw e;
      }

      // Step 3: Append lines in batches (AMI limit: ~32 headers per request)
      for (let batchStart = 0; batchStart < lines.length; batchStart += BATCH_SIZE) {
        const batch = lines.slice(batchStart, batchStart + BATCH_SIZE);
        const batchAction: Record<string, string> = {
          action: 'UpdateConfig',
          srcfilename: filename,
          dstfilename: filename,
          reload: 'no',
        };

        batch.forEach((line, idx) => {
          const paddedIdx = String(idx).padStart(6, '0');
          batchAction[`Action-${paddedIdx}`] = 'Append';
          batchAction[`Cat-${paddedIdx}`] = category.name;

          // Split on first '=>' or '=' to extract Var/Value for AMI
          const arrowPos = line.indexOf('=>');
          if (arrowPos !== -1) {
            batchAction[`Var-${paddedIdx}`] = line.substring(0, arrowPos).trim();
            batchAction[`Value-${paddedIdx}`] = `> ${line.substring(arrowPos + 2).trim()}`;
          } else {
            const eqPos = line.indexOf('=');
            if (eqPos !== -1) {
              batchAction[`Var-${paddedIdx}`] = line.substring(0, eqPos).trim();
              batchAction[`Value-${paddedIdx}`] = line.substring(eqPos + 1).trim();
            } else {
              batchAction[`Var-${paddedIdx}`] = line;
              batchAction[`Value-${paddedIdx}`] = '';
            }
          }
        });

        try {
          const res = await this.amiService.action(batchAction);
          if (res && res.response === 'Error') {
            this.logger.error(`AMI Append error for [${category.name}]: ${res.message || 'Unknown'}`);
            throw new Error(`AMI UpdateConfig Append failed: ${res.message || 'Unknown error'}`);
          }
        } catch (e: any) {
          this.logger.error(`Failed to apply dialplan for [${category.name}]: ${e?.message || e}`);
          throw e;
        }
      }

      totalLines += lines.length;
      this.logger.log(`Dialplan applied: [${category.name}] ${lines.length} lines`);
    }

    if (opts.reload !== false) {
      await this.amiService.command('dialplan reload');
    }

    return { success: true, linesApplied: totalLines };
  }

  /**
   * Delete one or more categories from a config file (DelCat only — no NewCat/Append).
   *
   * Used to clean up orphaned per-binding categories (`pb_bind_{uid}_{vpbx}`) after
   * their `route_phonebook_bindings` row is destroyed (e.g. phonebook delete) — the
   * category would otherwise remain in the .conf file referencing nothing (Pitfall 5).
   */
  async deleteCategories(
    filename: string,
    categoryNames: string[],
    opts: ApplyCategoriesOptions = {},
  ): Promise<{ success: boolean }> {
    for (const name of categoryNames) {
      try {
        await this.amiService.action({
          action: 'UpdateConfig',
          srcfilename: filename,
          dstfilename: filename,
          reload: 'no',
          'Action-000000': 'DelCat',
          'Cat-000000': name,
        });
      } catch (e) {
        // Expected: category may already be gone
      }
    }

    if (opts.reload !== false) {
      await this.amiService.command('dialplan reload');
    }

    return { success: true };
  }
}
