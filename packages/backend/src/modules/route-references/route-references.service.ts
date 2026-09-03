import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/sequelize';
import { Route } from '../routes/route.model';
import { RouteDirectoryBinding } from '../directories/route-directory-binding.model';
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
    const [routes, bindings] = await Promise.all([
      this.routeModel.findAll({
        where: { user_uid: vpbxUserUid },
        attributes: ['uid', 'actions', 'raw_dialplan'],
      }),
      kind === 'directory'
        ? this.bindingModel.findAll({ where: { user_uid: vpbxUserUid } })
        : Promise.resolve([]),
    ]);

    const references = collectActionReferences(kind, uid, routes, bindings, fieldUid);
    const hasRawDialplanRoutes = routes.some((route) => isNonEmptyRawDialplan(route.raw_dialplan));
    return {
      references,
      hasRawDialplanRoutes,
      meta: { hasRawDialplanRoutes },
    };
  }
}
