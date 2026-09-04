import { ConflictException, Injectable, Optional } from '@nestjs/common';
import { InjectModel } from '@nestjs/sequelize';
import { Route } from '../routes/route.model';
import { RouteDirectoryBinding } from '../directories/route-directory-binding.model';
import { Ivr } from '../ivrs/ivr.model';
import {
  collectActionReferences,
  type ActionReference,
  type ActionReferenceKind,
} from './action-reference.util';

export interface RouteUsageResponse {
  references: ActionReference[];
  hasRawDialplanRoutes: boolean;
  meta: { hasRawDialplanRoutes: boolean };
}

function isNonEmptyRawDialplan(value: unknown): boolean {
  return typeof value === 'string' && value.trim().length > 0;
}

@Injectable()
export class RouteReferencesService {
  constructor(
    @InjectModel(Route) private readonly routeModel: typeof Route,
    @InjectModel(RouteDirectoryBinding) private readonly bindingModel: typeof RouteDirectoryBinding,
    @Optional() @InjectModel(Ivr) private readonly ivrModel?: typeof Ivr,
  ) {}

  /**
   * Tenant-scoped scan. `vpbxUserUid` MUST come from JWT — never from the client body.
   */
  async findReferences(
    kind: ActionReferenceKind,
    uid: number | string,
    vpbxUserUid: number,
    fieldUid?: number,
  ): Promise<ActionReference[]> {
    const { references } = await this.findUsage(kind, uid, vpbxUserUid, fieldUid);
    return references;
  }

  async findUsage(
    kind: ActionReferenceKind,
    uid: number | string,
    vpbxUserUid: number,
    fieldUid?: number,
  ): Promise<RouteUsageResponse> {
    const [routes, bindings, ivrs] = await Promise.all([
      this.routeModel.findAll({
        where: { user_uid: vpbxUserUid },
        attributes: ['uid', 'name', 'extensions', 'active', 'actions', 'raw_dialplan'],
      }),
      kind === 'directory'
        ? this.bindingModel.findAll({ where: { user_uid: vpbxUserUid } })
        : Promise.resolve([]),
      this.ivrModel
        ? this.ivrModel.findAll({
            where: { user_uid: vpbxUserUid },
            attributes: ['uid', 'name', 'menu_items'],
          })
        : Promise.resolve([]),
    ]);

    const references = collectActionReferences(kind, uid, routes, bindings, fieldUid, ivrs);
    const hasRawDialplanRoutes = routes.some((route) => isNonEmptyRawDialplan(route.raw_dialplan));
    return {
      references,
      hasRawDialplanRoutes,
      meta: { hasRawDialplanRoutes },
    };
  }

  /**
   * Server-side delete backstop (D-48 / T-14-04). Same 409 shape as DirectoriesService.remove.
   */
  async assertNotReferenced(
    kind: ActionReferenceKind,
    uid: number | string | Array<number | string>,
    vpbxUserUid: number,
    message: string,
  ): Promise<void> {
    const ids = Array.isArray(uid) ? uid : [uid];
    const seen = new Set<string>();
    const references: ActionReference[] = [];
    for (const id of ids) {
      for (const hit of await this.findReferences(kind, id, vpbxUserUid)) {
        const key = `${hit.routeUid}:${hit.actionOrBindingId}:${hit.location}`;
        if (seen.has(key)) continue;
        seen.add(key);
        references.push(hit);
      }
    }
    if (references.length) {
      throw new ConflictException({ message, references });
    }
  }
}
