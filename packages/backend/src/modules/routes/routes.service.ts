import { Injectable, NotFoundException, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/sequelize';
import { Route } from './route.model';
import { AsteriskDialplanUtils } from '../../shared/utils/dialplan.util';

@Injectable()
export class RoutesService {
  private readonly logger = new Logger(RoutesService.name);

  constructor(
    @InjectModel(Route) private routeModel: typeof Route,
  ) {}

  /** Get all routes for a specific context */
  async findAllByContext(contextUid: number, vpbxUserUid: number): Promise<Route[]> {
    return this.routeModel.findAll({
      where: { context_uid: contextUid, user_uid: vpbxUserUid },
      order: [['priority', 'ASC'], ['uid', 'ASC']],
    });
  }

  /** Get a single route by ID */
  async findOne(uid: number, vpbxUserUid: number): Promise<Route> {
    const route = await this.routeModel.findOne({
      where: { uid, user_uid: vpbxUserUid },
    });
    if (!route) throw new NotFoundException('Route not found');
    return route;
  }

  /** Create a new route */
  async create(data: Partial<Route>, vpbxUserUid: number): Promise<Route> {
    // Get the next priority
    const maxPriority = await this.routeModel.max('priority', {
      where: { context_uid: data.context_uid, user_uid: vpbxUserUid },
    }) as number | null;

    return this.routeModel.create({
      ...data,
      priority: (maxPriority || 0) + 1,
      user_uid: vpbxUserUid,
    } as any);
  }

  /** Update an existing route */
  async update(uid: number, data: Partial<Route>, vpbxUserUid: number): Promise<Route> {
    const route = await this.findOne(uid, vpbxUserUid);
    await route.update(data);
    return route;
  }

  /** Delete a route */
  async remove(uid: number, vpbxUserUid: number): Promise<void> {
    const route = await this.findOne(uid, vpbxUserUid);
    await route.destroy();
  }

  /** Reorder routes within a context */
  async reorder(contextUid: number, orderedIds: number[], vpbxUserUid: number): Promise<void> {
    const promises = orderedIds.map((id, index) =>
      this.routeModel.update(
        { priority: index },
        { where: { uid: id, context_uid: contextUid, user_uid: vpbxUserUid } },
      ),
    );
    await Promise.all(promises);
  }

  /** Duplicate a route */
  async duplicate(uid: number, vpbxUserUid: number): Promise<Route> {
    const source = await this.findOne(uid, vpbxUserUid);
    const data = source.toJSON();
    delete data.uid;
    delete data.created_at;
    delete data.updated_at;
    data.name = `Копия — ${data.name}`;
    return this.create(data, vpbxUserUid);
  }

  /**
   * Generate raw dialplan text from JSON actions for a single route.
   * This produces Asterisk-compatible dialplan configuration.
   */
  generateRouteDialplan(route: Route, vpbxUserUid: number): string {
    const lines: string[] = [];
    const extensions = route.extensions || [];
    const actions = route.actions || [];
    const opts = route.options || {};

    for (const ext of extensions) {
      lines.push(`exten => ${ext},1,NoOp(Route: ${route.name})`);
      lines.push(`same => n,Set(CDR(vpbx_user_uid)=${vpbxUserUid})`);
      lines.push('same => n,ExecIf($["${ORIGUNIQUEID}" = ""]?Set(__ORIGUNIQUEID=${UNIQUEID}))');
      lines.push('same => n,ExecIf($["${ORIGEXTEN}" = ""]?Set(__ORIGEXTEN=${EXTEN}))');
      lines.push('same => n,ExecIf($["${ORIGCLIDNUM}" = ""]?Set(__ORIGCLIDNUM=${CALLERID(num)}))');
      lines.push('same => n,Set(__CLIDNUM=${CALLERID(num)})');
      lines.push('same => n,Set(CDR(usrc)=${CLIDNUM})');
      lines.push('same => n,Set(__STARTTIME=${EPOCH})');

      // Pre-command
      if (opts.pre_command) {
        lines.push(`same => n,${opts.pre_command}`);
      }

      // Call recording
      if (opts.record) {
        lines.push('same => n,Set(__path=${STRFTIME(${EPOCH},,%Y%m%d)})');
        lines.push('same => n,Set(__fname=${STRFTIME(${EPOCH},,%Y%m%d%H%M%S)}-${CALLERID(num)}-${EXTEN})');
        const rpath = `${vpbxUserUid}/calls`;
        const monFlag = opts.record_all ? '' : 'b';
        lines.push(`same => n,Set(__monopt=nice /usr/bin/lame -b 16 --resample 32 -q5 --silent "/usr/records/${rpath}/\${path}/\${fname}.wav" "/usr/records/${rpath}/\${path}/\${fname}.mp3" && rm -f "/usr/records/${rpath}/\${path}/\${fname}.wav")`);
        lines.push(`same => n,Set(CDR(record)=${rpath}/\${path}/\${fname})`);
        lines.push(`same => n,MixMonitor(/usr/records/${rpath}/\${path}/\${fname}.wav,${monFlag},\${monopt})`);
      }

      // Blacklist check
      if (opts.check_blacklist) {
        lines.push(`same => n,ExecIf($["\${SHELL(/usr/scripts/check_blacklist.php "\${CALLERID(num)}" "${vpbxUserUid}")}" != ""]?hangup())`);
      }

      // Listbook name lookup
      if (opts.check_listbook) {
        lines.push(`same => n,ExecIf($["\${SHELL(/usr/scripts/check_listbook.php "\${CALLERID(num)}" "${vpbxUserUid}")}" != ""]?Set(CALLERID(name)=\${SHELL(/usr/scripts/check_listbook.php "\${CALLERID(num)}" "${vpbxUserUid}")}))`);
      }

      // Actions
      for (const action of actions) {
        const dp = AsteriskDialplanUtils.actionToDialplan(action, vpbxUserUid);
        if (dp) lines.push(`same => n,${dp}`);
      }

      lines.push(''); // blank line between extensions
    }

    return lines.join('\n');
  }

  /**
   * Generate the full dialplan for a context (all routes + includes).
   */
  async generateContextDialplan(contextUid: number, vpbxUserUid: number, contextName: string, includes: string[]): Promise<string> {
    const routes = await this.findAllByContext(contextUid, vpbxUserUid);
    const lines: string[] = [];

    lines.push(`[${contextName}]`);

    // Includes
    for (const inc of includes) {
      lines.push(`include => ${inc}`);
    }

    if (includes.length > 0) lines.push('');

    // Routes
    for (const route of routes) {
      if (!route.active) continue;
      lines.push(`; --- ${route.name} ---`);
      lines.push(this.generateRouteDialplan(route, vpbxUserUid));
    }

    return lines.join('\n');
  }

  /** Bulk delete routes */
  async bulkRemove(uids: number[], vpbxUserUid: number): Promise<{ deleted: number }> {
    const deleted = await this.routeModel.destroy({
      where: { uid: uids, user_uid: vpbxUserUid },
    });
    return { deleted };
  }
}
