import { Injectable } from '@nestjs/common';
import {
  walkDialplanGraph,
  type WalkAction,
  type WalkDialplanResult,
  type WalkMenuItem,
  type WalkResolvedIvr,
  type WalkResolvedRoute,
  type ExactRouteCandidate,
} from '@krasterisk/shared';
import { RoutesService } from '../routes/routes.service';
import { IvrsService } from '../ivrs/ivrs.service';
import { ContextsService } from '../contexts/contexts.service';
import { DryRunRequestDto, DryRunResultDto } from './dto/dry-run.dto';

function asActions(raw: unknown): WalkAction[] {
  return Array.isArray(raw) ? (raw as WalkAction[]) : [];
}

function asMenuItems(raw: unknown): WalkMenuItem[] {
  if (!Array.isArray(raw)) return [];
  return raw.map((item) => ({
    digit: String(item?.digit ?? ''),
    actions: asActions(item?.actions),
  }));
}

@Injectable()
export class DialplanDryRunService {
  constructor(
    private readonly routesService: RoutesService,
    private readonly ivrsService: IvrsService,
    private readonly contextsService: ContextsService,
  ) {}

  /**
   * Deterministic dry-run (D-29). `vpbxUserUid` MUST come from JWT / AI tool arg — never the body.
   */
  async run(vpbxUserUid: number, input: DryRunRequestDto): Promise<DryRunResultDto> {
    const [ivrs, routes, contexts] = await Promise.all([
      this.ivrsService.findAll(vpbxUserUid),
      this.routesService.findAll(vpbxUserUid),
      this.contextsService.findAll(vpbxUserUid),
    ]);

    const ivrByUid = new Map(ivrs.map((ivr) => [ivr.uid, ivr]));
    const contextByName = new Map(contexts.map((ctx) => [ctx.name, ctx]));
    const routeByUid = new Map(routes.map((route) => [route.uid, route]));

    const resolveIvr = (ivrUid: number): WalkResolvedIvr | undefined => {
      const ivr = ivrByUid.get(ivrUid);
      if (!ivr) return undefined;
      return {
        uid: ivr.uid,
        name: ivr.name,
        menu_items: asMenuItems(ivr.menu_items),
      };
    };

    const resolveRoutesInContext = (contextName: string): ExactRouteCandidate[] => {
      const ctx = contextByName.get(contextName);
      if (!ctx) return [];
      return routes
        .filter((route) => route.context_uid === ctx.uid)
        .map((route) => ({
          uid: route.uid,
          name: route.name,
          extensions: Array.isArray(route.extensions) ? route.extensions : [],
          active: route.active,
        }));
    };

    const resolveRoute = (routeUid: number): WalkResolvedRoute | undefined => {
      const route = routeByUid.get(routeUid);
      if (!route) return undefined;
      return {
        uid: route.uid,
        name: route.name,
        actions: asActions(route.actions),
      };
    };

    const walked = walkDialplanGraph({
      host: input.host,
      actions: input.actions,
      menu_items: input.menu_items,
      scenario: input.scenario,
      ivrChoice: input.ivrChoice,
      callerNumber: input.callerNumber,
      resolveIvr,
      resolveRoutesInContext,
      resolveRoute,
    });

    return this.toDto(walked);
  }

  private toDto(walked: WalkDialplanResult): DryRunResultDto {
    return {
      segments: walked.segments,
      breadcrumbs: walked.breadcrumbs,
      hopsUsed: walked.hopsUsed,
      hopLimit: walked.hopLimit,
      outcome: walked.outcome,
      ...(walked.ivrInputs ? { ivrInputs: walked.ivrInputs } : {}),
      ...(walked.reask
        ? {
            reask: {
              source: walked.reask.source,
              keys: walked.reask.keys,
              askedAfterRun: true as const,
              label: String(walked.reask.source),
            },
          }
        : {}),
    };
  }
}
