import { Injectable, NotFoundException, BadRequestException, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/sequelize';
import { ensureCdrVpbxUserUidInDialplan } from '@krasterisk/shared';
import { Route } from './route.model';
import { RoutePhonebookBinding } from '../phonebooks/route-phonebook-binding.model';
import { RoutePhonebook } from '../phonebooks/phonebook.model';
import { PhonebookEntry } from '../phonebooks/phonebook-entry.model';
import { AsteriskDialplanUtils } from '../../shared/utils/dialplan.util';

/** Binding payload accepted from CreateRouteDto/UpdateRouteDto (bindings field). */
export interface RouteBindingInput {
  phonebook_uid: number;
  match_mode?: string;
  behavior_type?: string;
  behavior_params?: Record<string, any> | null;
  actions?: any[] | null;
}

// Bindings + their phonebook (with entries, for var-key based dialplan generation),
// ordered by position ASC (Pitfall 8 — blacklist before VIP, etc.).
const BINDING_INCLUDE = {
  model: RoutePhonebookBinding,
  as: 'bindings',
  include: [
    {
      model: RoutePhonebook,
      as: 'phonebook',
      include: [{ model: PhonebookEntry, as: 'entries' }],
    },
  ],
};
const BINDING_ORDER: any = [{ model: RoutePhonebookBinding, as: 'bindings' }, 'position', 'ASC'];

@Injectable()
export class RoutesService {
  private readonly logger = new Logger(RoutesService.name);

  constructor(
    @InjectModel(Route) private routeModel: typeof Route,
    @InjectModel(RoutePhonebookBinding) private bindingModel: typeof RoutePhonebookBinding,
    @InjectModel(RoutePhonebook) private phonebookModel: typeof RoutePhonebook,
  ) {}

  /** Get all routes for the tenant */
  async findAll(vpbxUserUid: number): Promise<Route[]> {
    return this.routeModel.findAll({
      where: { user_uid: vpbxUserUid },
      include: [BINDING_INCLUDE],
      order: [['context_uid', 'ASC'], ['priority', 'ASC'], ['uid', 'ASC'], BINDING_ORDER],
    });
  }

  /** Get all routes for a specific context */
  async findAllByContext(contextUid: number, vpbxUserUid: number): Promise<Route[]> {
    return this.routeModel.findAll({
      where: { context_uid: contextUid, user_uid: vpbxUserUid },
      include: [BINDING_INCLUDE],
      order: [['priority', 'ASC'], ['uid', 'ASC'], BINDING_ORDER],
    });
  }

  /** Get a single route by ID */
  async findOne(uid: number, vpbxUserUid: number): Promise<Route> {
    const route = await this.routeModel.findOne({
      where: { uid, user_uid: vpbxUserUid },
      include: [BINDING_INCLUDE],
      order: [BINDING_ORDER],
    });
    if (!route) throw new NotFoundException('Route not found');
    return route;
  }

  /**
   * Ensure every referenced phonebook_uid belongs to this tenant — otherwise a route
   * could bind (and read, via runtime lookup) another tenant's phonebook (T-05-03).
   */
  private async validateBindingsOwnership(bindings: RouteBindingInput[], vpbxUserUid: number): Promise<void> {
    const phonebookUids = Array.from(new Set(bindings.map((b) => b.phonebook_uid)));
    if (phonebookUids.length === 0) return;
    const count = await this.phonebookModel.count({ where: { uid: phonebookUids, user_uid: vpbxUserUid } });
    if (count !== phonebookUids.length) {
      throw new BadRequestException('One or more phonebooks are invalid or belong to another tenant');
    }
  }

  /** Replace-all strategy for a route's bindings (pattern: entries in PhonebooksService.update). */
  private async replaceBindings(routeUid: number, bindings: RouteBindingInput[], vpbxUserUid: number): Promise<void> {
    await this.validateBindingsOwnership(bindings, vpbxUserUid);
    await this.bindingModel.destroy({ where: { route_uid: routeUid, user_uid: vpbxUserUid } });
    if (bindings.length > 0) {
      await this.bindingModel.bulkCreate(
        bindings.map((b, index) => ({
          route_uid: routeUid,
          phonebook_uid: b.phonebook_uid,
          position: index,
          match_mode: b.match_mode || 'on_match',
          behavior_type: b.behavior_type || 'vars_only',
          behavior_params: b.behavior_params ?? null,
          actions: b.actions ?? null,
          user_uid: vpbxUserUid,
        })),
      );
    }
  }

  /** Create a new route */
  async create(data: Partial<Route> & { bindings?: RouteBindingInput[] }, vpbxUserUid: number): Promise<Route> {
    const { bindings, ...rest } = data as any;

    // Get the next priority
    const maxPriority = await this.routeModel.max('priority', {
      where: { context_uid: rest.context_uid, user_uid: vpbxUserUid },
    }) as number | null;

    const payload = { ...rest } as Partial<Route>;
    if (payload.raw_dialplan?.trim()) {
      payload.raw_dialplan = ensureCdrVpbxUserUidInDialplan(payload.raw_dialplan, vpbxUserUid);
    }

    const route = await this.routeModel.create({
      ...payload,
      priority: (maxPriority || 0) + 1,
      user_uid: vpbxUserUid,
    } as any);

    if (bindings !== undefined) {
      await this.replaceBindings(route.uid, bindings, vpbxUserUid);
    }

    return this.findOne(route.uid, vpbxUserUid);
  }

  /** Update an existing route */
  async update(uid: number, data: Partial<Route> & { bindings?: RouteBindingInput[] }, vpbxUserUid: number): Promise<Route> {
    const route = await this.findOne(uid, vpbxUserUid);
    const { bindings, ...rest } = data as any;
    const payload = { ...rest } as Partial<Route>;
    if (payload.raw_dialplan?.trim()) {
      payload.raw_dialplan = ensureCdrVpbxUserUidInDialplan(payload.raw_dialplan, vpbxUserUid);
    }
    await route.update(payload);

    if (bindings !== undefined) {
      await this.replaceBindings(uid, bindings, vpbxUserUid);
    }

    return this.findOne(uid, vpbxUserUid);
  }

  /** Delete a route */
  async remove(uid: number, vpbxUserUid: number): Promise<void> {
    const route = await this.findOne(uid, vpbxUserUid);
    await route.destroy(); // CASCADE deletes bindings
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

  /** Duplicate a route (bindings are copied — phonebook_uid/match_mode/behavior, not uid/route_uid) */
  async duplicate(uid: number, vpbxUserUid: number): Promise<Route> {
    const source = await this.findOne(uid, vpbxUserUid);
    const data = source.toJSON();
    delete data.uid;
    delete data.created_at;
    delete data.updated_at;
    data.name = `Копия - ${data.name}`;
    return this.create(data, vpbxUserUid);
  }

  /**
   * Generate raw dialplan text from JSON actions for a single route.
   * This produces Asterisk-compatible dialplan configuration.
   */
  generateRouteDialplan(route: Route, vpbxUserUid: number, isAdmin: boolean = false): string {
    const raw = route.raw_dialplan?.trim();
    if (raw) {
      return ensureCdrVpbxUserUidInDialplan(raw, vpbxUserUid);
    }

    const lines: string[] = [];
    const extensions = route.extensions || [];
    const actions = route.actions || [];
    const opts = route.options || {};
    const wh = route.webhooks || {};
    const backendUrl = AsteriskDialplanUtils.backendBaseUrl;
    const apiKey = AsteriskDialplanUtils.dialplanApiKey;
    const keyParam = apiKey ? `&api_key=${encodeURIComponent(apiKey)}` : '';

    const bindings = ((route as any).bindings as RoutePhonebookBinding[] | undefined) || [];
    const orderedBindings = bindings.slice().sort((a, b) => a.position - b.position);

    for (const ext of extensions) {
      lines.push(`exten => ${ext},1,NoOp(Route: ${route.name})`);
      lines.push(`same => n,Set(CDR(vpbx_user_uid)=${vpbxUserUid})`);
      lines.push(`same => n,Set(__HH_ROUTE_UID=${route.uid})`);
      lines.push('same => n,ExecIf($["${ORIGUNIQUEID}" = ""]?Set(__ORIGUNIQUEID=${UNIQUEID}))');
      lines.push('same => n,ExecIf($["${ORIGEXTEN}" = ""]?Set(__ORIGEXTEN=${EXTEN}))');
      lines.push('same => n,ExecIf($["${ORIGCLIDNUM}" = ""]?Set(__ORIGCLIDNUM=${CALLERID(num)}))');
      lines.push('same => n,Set(__CLIDNUM=${CALLERID(num)})');
      lines.push('same => n,Set(CDR(usrc)=${CLIDNUM})');
      lines.push('same => n,Set(__STARTTIME=${EPOCH})');

      // --- Webhook flag variables ---
      // Double underscore (__) ensures inheritance into all child channels (Local/, Queue member, etc.)
      // Flags are set ONLY when a webhook URL is configured — avoids CURL overhead for routes without webhooks
      if (wh.before_dial?.url) lines.push('same => n,Set(__WH_BD=1)');
      if (wh.on_answer?.url)   lines.push('same => n,Set(__WH_OA=1)');
      if (wh.on_hangup?.url)   lines.push('same => n,Set(__WH_OH=1)');
      if (wh.custom?.url)      lines.push('same => n,Set(__WH_CUSTOM=1)');

      // Pre-command
      if (opts.pre_command) {
        lines.push(`same => n,${opts.pre_command}`);
      }

      // --- Call recording (ffmpeg instead of lame) ---
      // ffmpeg: faster startup, better quality control, maintained project, supports more formats
      // -codec:a libmp3lame -b:a 32k -ar 8000 -ac 1 = mono 32kbps 8kHz — matches telephony quality
      // nice -n 10: low-priority background process, does not affect Asterisk real-time performance
      // MixMonitor postprocess (&) is fire-and-forget — conversion happens AFTER channel hangs up
      if (opts.record) {
        const recordAll = opts.record_all === true;
        lines.push('same => n,Set(__path=${STRFTIME(${EPOCH},,%Y%m%d)})');
        // Sanitize CALLERID(num): strip everything except digits and + to prevent path traversal
        lines.push('same => n,Set(__safeclid=${REGEX_REPLACE(${CALLERID(num)},^[^0-9+]+$,)})');
        lines.push('same => n,Set(__fname=${STRFTIME(${EPOCH},,%Y%m%d%H%M%S)}-${safeclid}-${EXTEN})');
        const rpath = `${vpbxUserUid}/calls`;
        const monFlag = recordAll ? '' : 'b';
        // ffmpeg conversion + wav cleanup as MixMonitor postprocess (runs after hangup in background)
        // Note: if on_hangup webhook is set, hangup_handler (set below) will handle conversion
        // and ensure MP3 is ready before notifying the backend. Otherwise use postprocess directly.
        if (!wh.on_hangup?.url) {
          lines.push(`same => n,Set(__monopt=nice -n 10 /usr/bin/ffmpeg -y -i /usr/records/${rpath}/\${path}/\${fname}.wav -codec:a libmp3lame -b:a 32k -ar 8000 -ac 1 /usr/records/${rpath}/\${path}/\${fname}.mp3 -loglevel quiet && rm -f /usr/records/${rpath}/\${path}/\${fname}.wav)`);
          lines.push(`same => n,Set(CDR(record)=${rpath}/\${path}/\${fname})`);
          lines.push(`same => n,MixMonitor(/usr/records/${rpath}/\${path}/\${fname}.wav,${monFlag},\${monopt})`);
        } else {
          // on_hangup is configured: MixMonitor WITHOUT postprocess — hangup_handler takes over
          // This guarantees MP3 is ready before the on_hangup webhook fires
          lines.push(`same => n,Set(CDR(record)=${rpath}/\${path}/\${fname})`);
          lines.push(`same => n,MixMonitor(/usr/records/${rpath}/\${path}/\${fname}.wav,${monFlag})`);
        }
      }

      // --- Hangup handler registration ---
      // Registered when: on_hangup webhook needs notification, OR recording needs guaranteed MP3 conversion
      // hangup_handler_push executes [krsk-hangup-handler] on channel teardown (even on Hangup())
      // Covers: ffmpeg conversion + on_hangup webhook CURL (only if WH_OH=1)
      if (wh.on_hangup?.url || (opts.record && wh.on_hangup?.url)) {
        lines.push('same => n,Set(CHANNEL(hangup_handler_push)=krsk-hangup-handler,s,1)');
      }

      // Phonebook binding chain (cascading Gosub/Return), ordered by position ASC (D-03, D-05)
      for (const binding of orderedBindings) {
        lines.push(`same => n,Gosub(pb_bind_${binding.uid}_${vpbxUserUid},s,1)`);
      }

      // Legacy blacklist check (backward compat — only when no phonebook binding replaces it)
      if (opts.check_blacklist && orderedBindings.length === 0) {
        lines.push(`same => n,ExecIf($["\${SHELL(/usr/scripts/check_blacklist.php "\${CALLERID(num)}" "${vpbxUserUid}")}" != ""]?hangup())`);
      }

      // Listbook name lookup
      if (opts.check_listbook) {
        lines.push(`same => n,ExecIf($["\${SHELL(/usr/scripts/check_listbook.php "\${CALLERID(num)}" "${vpbxUserUid}")}" != ""]?Set(CALLERID(name)=\${SHELL(/usr/scripts/check_listbook.php "\${CALLERID(num)}" "${vpbxUserUid}")}))`);
      }

      // --- Custom webhook (DIALTO) ---
      // Synchronous: Asterisk waits for response (timeout: 4s via CURLOPT)
      // Backend returns the responsible employee's internal extension (digits only) or empty string
      // __DIALTO: double underscore ensures it's inherited by child channels
      if (wh.custom?.url) {
        lines.push('same => n,Set(CURLOPT(conntimeout)=3)');
        lines.push('same => n,Set(CURLOPT(timeout)=4)');
        lines.push(`same => n,Set(__DIALTO=\${CURL(${backendUrl}/internal/dialplan/custom-webhook,route_uid=\${HH_ROUTE_UID}&uniqueid=\${URIENCODE(\${UNIQUEID})}&clid=\${URIENCODE(\${CALLERID(num)})}&user_uid=${vpbxUserUid}${keyParam})})`);
        // Reset CURLOPT to defaults for subsequent CURL calls
        lines.push('same => n,Set(CURLOPT(conntimeout)=)');
        lines.push('same => n,Set(CURLOPT(timeout)=)');
      }

      // --- Before-dial webhook ---
      // Synchronous: fires before Dial/Queue — CRM can register the call, set CallerID name, etc.
      // Timeout is intentionally short (3s connect / 5s total) — a slow CRM should not block calls
      if (wh.before_dial?.url) {
        lines.push('same => n,ExecIf($["${WH_BD}" = "1"]?Set(CURLOPT(conntimeout)=3))');
        lines.push('same => n,ExecIf($["${WH_BD}" = "1"]?Set(CURLOPT(timeout)=5))');
        lines.push(`same => n,ExecIf($["\${WH_BD}" = "1"]?Set(WH_BD_RESULT=\${CURL(${backendUrl}/internal/dialplan/before-dial,route_uid=\${HH_ROUTE_UID}&uniqueid=\${URIENCODE(\${UNIQUEID})}&clid=\${URIENCODE(\${CALLERID(num)})}&exten=\${URIENCODE(\${EXTEN})}&user_uid=${vpbxUserUid}${keyParam})}))`);
        lines.push('same => n,Set(CURLOPT(conntimeout)=)');
        lines.push('same => n,Set(CURLOPT(timeout)=)');
      }

      // --- Actions ---
      // Pass webhooks context so Dial/Queue actions can add U()/gosub for on_answer
      for (const action of actions) {
        const dp = AsteriskDialplanUtils.actionToDialplan(action, vpbxUserUid, isAdmin, wh);
        if (dp) lines.push(`same => n,${dp}`);
      }

      lines.push(''); // blank line between extensions
    }

    return lines.join('\n');
  }

  private buildContextName(contextName: string, vpbxUserUid: number): string {
    const suffix = String(vpbxUserUid);
    return contextName.endsWith(suffix) ? contextName : `${contextName}${suffix}`;
  }

  /**
   * Generate the full dialplan for a context (all routes + includes).
   */
  async generateContextDialplan(contextUid: number, vpbxUserUid: number, contextName: string, includes: string[], isAdmin: boolean = false): Promise<string> {
    const routes = await this.findAllByContext(contextUid, vpbxUserUid);
    const lines: string[] = [];

    const tenantedContextName = this.buildContextName(contextName, vpbxUserUid);

    lines.push(`[${tenantedContextName}]`);

    // Includes
    for (const inc of includes) {
      lines.push(`include => ${this.buildContextName(inc, vpbxUserUid)}`);
    }

    if (includes.length > 0) lines.push('');

    // Routes
    for (const route of routes) {
      if (!route.active) continue;
      lines.push(`; --- ${route.name} ---`);
      lines.push(this.generateRouteDialplan(route, vpbxUserUid, isAdmin));
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
