import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/sequelize';
import { RoutesService } from './routes.service';
import { ContextIncludesService } from './context-includes.service';
import { DialplanApplyService } from '../ami/dialplan-apply.service';
import { Context } from '../contexts/context.model';
import { RouteDirectoryBinding } from '../directories/route-directory-binding.model';
import { generatePolicyDialplan, GeneratedDialplanCategory } from '../directories/directory-policy-dialplan.util';

export interface ApplyContextResult {
  success: boolean;
  filename: string;
  linesApplied: number;
}

/**
 * Orchestrates apply of a route context:
 *   1. Directory policy contexts (dir_policy_{uid}_{vpbx}) for all bindings on the
 *      context's routes — written to krasterisk/directories/dir_{vpbx}.conf, no reload.
 *   2. The route context itself — written to krasterisk/routes/extensions_{ctx}.conf,
 *      single dialplan reload at the end.
 */
@Injectable()
export class RouteApplyService {
  constructor(
    private readonly routesService: RoutesService,
    private readonly contextIncludesService: ContextIncludesService,
    private readonly dialplanApplyService: DialplanApplyService,
    @InjectModel(Context) private readonly contextModel: typeof Context,
  ) {}

  private buildContextName(contextName: string, vpbxUserUid: number): string {
    const suffix = String(vpbxUserUid);
    return contextName.endsWith(suffix) ? contextName : `${contextName}${suffix}`;
  }

  async applyContext(contextUid: number, vpbxUserUid: number, isAdmin: boolean = false): Promise<ApplyContextResult> {
    const context = await this.contextModel.findOne({ where: { uid: contextUid, user_uid: vpbxUserUid } });
    if (!context) throw new NotFoundException('Context not found');

    const includes = await this.contextIncludesService.getIncludeNames(contextUid, vpbxUserUid);
    const routes = await this.routesService.findAllByContext(contextUid, vpbxUserUid);
    const tenantedContextName = this.buildContextName(context.name, vpbxUserUid);

    const policyCategories: GeneratedDialplanCategory[] = [];
    for (const route of routes) {
      const bindings = ((route as any).bindings as RouteDirectoryBinding[] | undefined) || [];
      const ordered = bindings.slice().sort((a, b) => a.position - b.position);
      for (const binding of ordered) {
        const directory = binding.directory;
        if (!directory) continue;
        policyCategories.push(
          generatePolicyDialplan(binding, directory, vpbxUserUid, tenantedContextName, isAdmin),
        );
      }
    }

    if (policyCategories.length > 0) {
      await this.dialplanApplyService.applyCategories(
        `krasterisk/directories/dir_${vpbxUserUid}.conf`,
        policyCategories,
        { reload: false },
      );
    }

    const dialplan = await this.routesService.generateContextDialplan(
      contextUid, vpbxUserUid, context.name, includes, isAdmin,
    );
    const filename = `krasterisk/routes/extensions_${tenantedContextName}.conf`;
    const categories: GeneratedDialplanCategory[] = [];
    let current = { name: tenantedContextName, lines: [] as string[] };
    for (const line of dialplan.split('\n')) {
      const heading = /^\[([^\]]+)\]$/.exec(line.trim());
      if (heading) {
        if (current.lines.length || categories.length) categories.push(current);
        current = { name: heading[1], lines: [] };
      } else current.lines.push(line);
    }
    categories.push(current);
    const result = await this.dialplanApplyService.applyCategories(filename, categories, { reload: true, replaceAll: true });

    return { success: result.success, filename, linesApplied: result.linesApplied };
  }

  /** Replace a deleted context's managed category with an empty, non-callable one. */
  async clearContext(contextName: string, tenant: number): Promise<void> {
    const name = this.buildContextName(contextName, tenant);
    await this.dialplanApplyService.applyCategories(`krasterisk/routes/extensions_${name}.conf`, [{ name, lines: [] }], { reload: true, replaceAll: true });
  }
}
