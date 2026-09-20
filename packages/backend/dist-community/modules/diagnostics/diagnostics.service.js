"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.DiagnosticsService = exports.DIAGNOSTIC_EVENT_CAP = exports.DIAGNOSTIC_EVENT_WINDOW_MS = exports.LIVE_CHANNEL_CAP = exports.DIAGNOSTIC_READ_COMMANDS = void 0;
exports.resolveDiagnosticCommand = resolveDiagnosticCommand;
exports.extractCommandText = extractCommandText;
exports.parseConciseChannels = parseConciseChannels;
exports.parseDialplanShow = parseDialplanShow;
const common_1 = require("@nestjs/common");
const ami_service_1 = require("../ami/ami.service");
const contexts_service_1 = require("../contexts/contexts.service");
const endpoints_service_1 = require("../endpoints/endpoints.service");
const cdr_service_1 = require("../reports/cdr/cdr.service");
/** Named diagnostic reads → fixed switch CLI. Callers never supply a command string. */
exports.DIAGNOSTIC_READ_COMMANDS = {
    live_channels: 'core show channels concise',
    compiled_dialplan: 'dialplan show',
};
/** Peak tenants can exceed a turn's context; the cap is reported when it truncates. */
exports.LIVE_CHANNEL_CAP = 25;
/** Recent-event window and count — three tools share one diagnostic turn. */
exports.DIAGNOSTIC_EVENT_WINDOW_MS = 15 * 60 * 1000;
exports.DIAGNOSTIC_EVENT_CAP = 20;
function resolveDiagnosticCommand(name) {
    if (!Object.prototype.hasOwnProperty.call(exports.DIAGNOSTIC_READ_COMMANDS, name)) {
        throw new Error(`Diagnostic command '${name}' is not allowed`);
    }
    return exports.DIAGNOSTIC_READ_COMMANDS[name];
}
function extractCommandText(raw) {
    if (typeof raw === 'string')
        return raw;
    if (raw && typeof raw === 'object') {
        const rec = raw;
        if (typeof rec.output === 'string')
            return rec.output;
        if (Array.isArray(rec.output))
            return rec.output.map(String).join('\n');
        if (typeof rec.content === 'string')
            return rec.content;
    }
    return '';
}
function parseConciseChannels(text) {
    const rows = [];
    for (const line of text.split(/\r?\n/)) {
        const trimmed = line.trim();
        if (!trimmed || !trimmed.includes('!'))
            continue;
        const parts = trimmed.split('!');
        const channel = parts[0] ?? '';
        if (!channel.includes('/'))
            continue;
        rows.push({
            channel,
            context: parts[1] ?? '',
            endpoint: endpointFromChannel(channel),
            exten: parts[2] ?? '',
            state: parts[4] ?? '',
            application: parts[5] ?? '',
        });
    }
    return rows;
}
const DIALPLAN_EXTEN = /^\s+'([^']+)'\s*=>\s+(\d+)\.\s+(\S+)/;
const DIALPLAN_CONT = /^\s+(\d+)\.\s+(\S+)/;
function parseDialplanShow(text) {
    const rules = [];
    let currentExten = '';
    for (const line of text.split(/\r?\n/)) {
        const named = DIALPLAN_EXTEN.exec(line);
        if (named) {
            currentExten = named[1];
            rules.push({
                exten: currentExten,
                priority: Number(named[2]),
                application: named[3],
            });
            continue;
        }
        const cont = DIALPLAN_CONT.exec(line);
        if (cont && currentExten) {
            rules.push({
                exten: currentExten,
                priority: Number(cont[1]),
                application: cont[2],
            });
        }
    }
    return rules;
}
function endpointFromChannel(channel) {
    const afterTech = channel.includes('/') ? channel.slice(channel.indexOf('/') + 1) : channel;
    const dash = afterTech.indexOf('-');
    return dash === -1 ? afterTech : afterTech.slice(0, dash);
}
function belongsToTenant(row, contextNames, endpointIds) {
    if (row.context && contextNames.has(row.context))
        return true;
    if (row.endpoint && endpointIds.has(row.endpoint))
        return true;
    return false;
}
function toWindowStartIso(ms) {
    return new Date(ms).toISOString();
}
function compactEvent(row) {
    return {
        uniqueid: String(row.uniqueid ?? ''),
        calldate: String(row.calldate ?? ''),
        src: String(row.src ?? ''),
        dst: String(row.dst ?? ''),
        disposition: String(row.disposition ?? ''),
        dcontext: String(row.dcontext ?? ''),
    };
}
let DiagnosticsService = class DiagnosticsService {
    ami;
    contexts;
    endpoints;
    cdr;
    constructor(ami, contexts, endpoints, cdr) {
        this.ami = ami;
        this.contexts = contexts;
        this.endpoints = endpoints;
        this.cdr = cdr;
    }
    async readEndpointRegistration(vpbxUserUid, extension) {
        if (!/^\d{2,8}$/.test(extension))
            throw new Error('extension must contain 2–8 digits');
        const id = `e${extension}_${vpbxUserUid}`;
        const owned = (await this.endpoints.findAll(vpbxUserUid)).find(ep => ep.id === id);
        if (!owned)
            return { extension, exists: false, evidence: 'tenant endpoint inventory' };
        // PJSIPShowEndpoint also returns AuthDetail; never pass its raw events to a model.
        const result = await this.ami.pjsipShowEndpoint(id);
        const events = result.events.filter(event => ['endpointdetail', 'contactstatusdetail', 'contactlist'].includes(String(event.event || '').toLowerCase()));
        return { extension, exists: true, observedAt: new Date().toISOString(),
            evidence: 'AMI PJSIPShowEndpoint',
            interpretation: 'DeviceState describes reachability, not proof of registration success or failure. Empty recent call events do not prove a registration problem. Determine the cause from registration/contact evidence and device logs.',
            states: events.slice(0, 10).map(event => ({
                event: String(event.event || ''), deviceState: String(event.devicestate || ''),
                contactStatus: String(event.status || ''), roundtripUsec: String(event.roundtripusec || ''),
            })), truncated: events.length > 10 };
    }
    async readLiveChannels(vpbxUserUid) {
        const command = resolveDiagnosticCommand('live_channels');
        const raw = await this.ami.command(command);
        const parsed = parseConciseChannels(extractCommandText(raw));
        const contextNames = await this.tenantContextNames(vpbxUserUid);
        const endpointIds = new Set((await this.endpoints.findAll(vpbxUserUid)).map((ep) => String(ep.id ?? '')).filter(Boolean));
        const matchedRows = parsed.filter((row) => belongsToTenant(row, contextNames, endpointIds));
        const truncated = matchedRows.length > exports.LIVE_CHANNEL_CAP;
        return {
            channels: matchedRows.slice(0, exports.LIVE_CHANNEL_CAP),
            truncated,
            cap: exports.LIVE_CHANNEL_CAP,
            matched: matchedRows.length,
        };
    }
    async readRecentEvents(vpbxUserUid) {
        const dateFrom = toWindowStartIso(Date.now() - exports.DIAGNOSTIC_EVENT_WINDOW_MS);
        const found = await this.cdr.findCalls(vpbxUserUid, {
            dateFrom,
            limit: exports.DIAGNOSTIC_EVENT_CAP,
        });
        const rows = Array.isArray(found.rows) ? found.rows : [];
        const compact = rows.map((row) => compactEvent(row));
        const truncated = compact.length > exports.DIAGNOSTIC_EVENT_CAP;
        return {
            events: compact.slice(0, exports.DIAGNOSTIC_EVENT_CAP),
            truncated,
            cap: exports.DIAGNOSTIC_EVENT_CAP,
            matched: compact.length,
            windowMs: exports.DIAGNOSTIC_EVENT_WINDOW_MS,
        };
    }
    async readCompiledDialplan(vpbxUserUid, contextName) {
        const owned = await this.tenantContextNames(vpbxUserUid);
        if (!owned.has(contextName)) {
            throw new Error(`Compiled dialplan for context '${contextName}' is refused: tenant does not own it`);
        }
        const prefix = resolveDiagnosticCommand('compiled_dialplan');
        const raw = await this.ami.command(`${prefix} ${contextName}`);
        return {
            context: contextName,
            rules: parseDialplanShow(extractCommandText(raw)),
            evaluationOrder: true,
            orderNote: 'Rules are listed in evaluation order',
        };
    }
    async tenantContextNames(vpbxUserUid) {
        const suffix = String(vpbxUserUid);
        return new Set((await this.contexts.findAll(vpbxUserUid)).map((ctx) => ctx.name.endsWith(suffix) ? ctx.name : `${ctx.name}${suffix}`));
    }
};
exports.DiagnosticsService = DiagnosticsService;
exports.DiagnosticsService = DiagnosticsService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [ami_service_1.AmiService,
        contexts_service_1.ContextsService,
        endpoints_service_1.EndpointsService,
        cdr_service_1.CdrService])
], DiagnosticsService);
//# sourceMappingURL=diagnostics.service.js.map