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
    const result = await this.dialplanApplyService.applyCategories(
      filename,
      [{ name: tenantedContextName, lines: dialplan.split('\n') }],
      { reload: true },
    );

    return { success: result.success, filename, linesApplied: result.linesApplied };
  }
}
