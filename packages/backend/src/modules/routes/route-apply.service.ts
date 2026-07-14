import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/sequelize';
import { RoutesService } from './routes.service';
import { ContextIncludesService } from './context-includes.service';
import { DialplanApplyService } from '../ami/dialplan-apply.service';
import { Context } from '../contexts/context.model';
import { RoutePhonebookBinding } from '../phonebooks/route-phonebook-binding.model';
import { generateBindingDialplan, GeneratedDialplanCategory } from '../phonebooks/phonebook-dialplan.util';

export interface ApplyContextResult {
  success: boolean;
  filename: string;
  linesApplied: number;
}

/**
 * Orchestrates the full apply of a route context (D-17):
 *   1. Phonebook binding contexts (pb_bind_{uid}_{vpbx}) for all bindings on the
 *      context's routes — written to krasterisk/phonebooks/pb_{vpbx}.conf, no reload.
 *   2. The route context itself — written to krasterisk/routes/extensions_{ctx}.conf,
 *      single dialplan reload at the end (Pitfall 5: bindings must exist before the
 *      route context's Gosub targets are (re)activated by the reload).
 *
 * Also used for the regen-triggers (D-18): phonebook var-key set changes, binding
 * changes, and phonebook delete all re-apply the affected route contexts through here.
 */
@Injectable()
export class RouteApplyService {
  private readonly logger = new Logger(RouteApplyService.name);

  constructor(
    private readonly routesService: RoutesService,
    private readonly contextIncludesService: ContextIncludesService,
    private readonly dialplanApplyService: DialplanApplyService,
    @InjectModel(Context) private readonly contextModel: typeof Context,
    @InjectModel(RoutePhonebookBinding) private readonly bindingModel: typeof RoutePhonebookBinding,
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

    // 1. Binding categories for every binding on every route of this context
    const bindingCategories: GeneratedDialplanCategory[] = [];
    for (const route of routes) {
      const bindings = ((route as any).bindings as RoutePhonebookBinding[] | undefined) || [];
      const ordered = bindings.slice().sort((a, b) => a.position - b.position);
      for (const binding of ordered) {
        const phonebook = (binding as any).phonebook;
        if (!phonebook) continue; // binding row survived a deleted phonebook race — skip defensively
        bindingCategories.push(generateBindingDialplan(binding, phonebook, vpbxUserUid, tenantedContextName, isAdmin));
      }
    }

    if (bindingCategories.length > 0) {
      await this.dialplanApplyService.applyCategories(
        `krasterisk/phonebooks/pb_${vpbxUserUid}.conf`,
        bindingCategories,
        { reload: false },
      );
    }

    // 2. Route context itself, then the single reload for both files
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

  /**
   * Re-apply every route context that has a binding to the given phonebook.
   * Used when a phonebook's var-key set changes (D-18) or its bindings change.
   */
  async applyContextsForPhonebook(phonebookUid: number, vpbxUserUid: number, isAdmin: boolean = false): Promise<void> {
    const contextUids = await this.getAffectedContextUids(phonebookUid, vpbxUserUid);
    for (const contextUid of contextUids) {
      try {
        await this.applyContext(contextUid, vpbxUserUid, isAdmin);
      } catch (e: any) {
        this.logger.error(`Failed to re-apply context ${contextUid} after phonebook ${phonebookUid} change: ${e?.message || e}`);
      }
    }
  }

  /**
   * Collect { contextUids, bindingUids } for all routes bound to a phonebook.
   * MUST be called BEFORE destroying the phonebook — FK CASCADE removes the
   * bindings rows on delete, so this data is only available beforehand.
   * `bindingUids` is used afterwards to DelCat the now-orphaned pb_bind_* categories.
   */
  async getAffectedContexts(phonebookUid: number, vpbxUserUid: number): Promise<{ contextUids: number[]; bindingUids: number[] }> {
    const bindings = await this.bindingModel.findAll({ where: { phonebook_uid: phonebookUid, user_uid: vpbxUserUid } });
    const bindingUids = bindings.map((b) => b.uid);
    const contextUids = await this.resolveContextUids(bindings.map((b) => b.route_uid), vpbxUserUid);
    return { contextUids, bindingUids };
  }

  private async getAffectedContextUids(phonebookUid: number, vpbxUserUid: number): Promise<number[]> {
    const bindings = await this.bindingModel.findAll({ where: { phonebook_uid: phonebookUid, user_uid: vpbxUserUid } });
    return this.resolveContextUids(bindings.map((b) => b.route_uid), vpbxUserUid);
  }

  private async resolveContextUids(routeUids: number[], vpbxUserUid: number): Promise<number[]> {
    const distinctRouteUids = Array.from(new Set(routeUids));
    const contextUids = new Set<number>();
    for (const routeUid of distinctRouteUids) {
      try {
        const route = await this.routesService.findOne(routeUid, vpbxUserUid);
        contextUids.add(route.context_uid);
      } catch {
        // route may have been deleted concurrently — ignore
      }
    }
    return Array.from(contextUids);
  }
}
