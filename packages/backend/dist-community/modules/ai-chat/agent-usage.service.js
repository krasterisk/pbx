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
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
var AgentUsageService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.AgentUsageService = void 0;
const common_1 = require("@nestjs/common");
const schedule_1 = require("@nestjs/schedule");
const sequelize_1 = require("@nestjs/sequelize");
const sequelize_2 = require("sequelize");
const ai_provider_model_1 = require("../ai-connectivity/ai-provider.model");
const ai_audit_log_model_1 = require("./models/ai-audit-log.model");
const agent_thread_model_1 = require("./models/agent-thread.model");
const agent_proposal_model_1 = require("./models/agent-proposal.model");
const ai_chat_settings_model_1 = require("./ai-chat-settings.model");
const tenant_model_1 = require("../cloud-admin/tenant.model");
const cloud_setting_model_1 = require("../cloud-admin/cloud-setting.model");
const SILENT_WRITE_INTERVAL_MS = 60 * 60 * 1000;
const SILENT_WRITE_WINDOW_MS = 24 * 60 * 60 * 1000;
const MUTATING_TOOL = /^(create_|update_|delete_|remove_|add_|assign_|apply_)/;
const LIVE_OPS = new Set(['cc_force_pause_agent', 'cc_force_unpause_agent']);
function hasTokenPricing(pricing) {
    if (!pricing || typeof pricing !== 'object')
        return false;
    const row = pricing;
    return typeof row.inputTokenUsd === 'number' && typeof row.outputTokenUsd === 'number';
}
function inRange(field, from, to) {
    return { [field]: { [sequelize_2.Op.between]: [from, to] } };
}
function isMutatingTool(name) {
    return !LIVE_OPS.has(name) && MUTATING_TOOL.test(name);
}
/**
 * Aggregates conversation-row token counters into per-tenant spend (D-08).
 * Reads `ai_agent_threads` only. The voice CDR table is left untouched.
 */
let AgentUsageService = AgentUsageService_1 = class AgentUsageService {
    threads;
    providers;
    proposals;
    audit;
    settings;
    tenants;
    cloudSettings;
    logger = new common_1.Logger(AgentUsageService_1.name);
    runningSilent = false;
    constructor(threads, providers, proposals, audit, settings, tenants, cloudSettings) {
        this.threads = threads;
        this.providers = providers;
        this.proposals = proposals;
        this.audit = audit;
        this.settings = settings;
        this.tenants = tenants;
        this.cloudSettings = cloudSettings;
    }
    async queryTenantUsage(from, to) {
        const conversations = (await this.threads.findAll({
            where: { last_message_at: { [sequelize_2.Op.between]: [from, to] } },
            attributes: ['vpbx_user_uid', 'provider_uid', 'tokens_in', 'tokens_out'],
        }));
        const providerRows = (await this.providers.findAll({
            attributes: ['uid', 'pricing'],
        }));
        const pricingByUid = new Map(providerRows.map((row) => [row.uid, row.pricing]));
        const grouped = new Map();
        for (const row of conversations) {
            const current = grouped.get(row.vpbx_user_uid) ?? {
                tokensIn: 0,
                tokensOut: 0,
                turns: 0,
                priced: 0,
                unpriced: false,
            };
            current.tokensIn += Number(row.tokens_in) || 0;
            current.tokensOut += Number(row.tokens_out) || 0;
            current.turns += 1;
            const pricing = row.provider_uid != null ? pricingByUid.get(row.provider_uid) : undefined;
            if (hasTokenPricing(pricing)) {
                current.priced +=
                    (Number(row.tokens_in) || 0) * pricing.inputTokenUsd +
                        (Number(row.tokens_out) || 0) * pricing.outputTokenUsd;
            }
            else {
                current.unpriced = true;
            }
            grouped.set(row.vpbx_user_uid, current);
        }
        const names = await this.resolveTenantNames([...grouped.keys()]);
        return [...grouped.entries()]
            .sort(([a], [b]) => a - b)
            .map(([tenantUid, value]) => ({
            tenantUid,
            tenantName: names.get(tenantUid) ?? null,
            tokensIn: value.tokensIn,
            tokensOut: value.tokensOut,
            turns: value.turns,
            spendUsd: value.unpriced ? null : value.priced,
            spendAvailable: !value.unpriced,
        }));
    }
    async resolveTenantNames(uids) {
        const names = new Map();
        if (uids.length === 0)
            return names;
        if (this.tenants) {
            try {
                const rows = await this.tenants.findAll({
                    where: { vpbx_user_uid: { [sequelize_2.Op.in]: uids } },
                    attributes: ['name', 'vpbx_user_uid'],
                });
                for (const row of rows) {
                    const name = typeof row.name === 'string' ? row.name.trim() : '';
                    if (name)
                        names.set(Number(row.vpbx_user_uid), name);
                }
            }
            catch (error) {
                this.logger.warn(`tenant names unavailable: ${error.message}`);
            }
        }
        if (uids.includes(0) && !names.has(0) && this.cloudSettings) {
            try {
                const seller = await this.cloudSettings.findOne({
                    where: { key: 'billing.seller.name' },
                });
                const sellerName = seller?.value?.trim();
                if (sellerName)
                    names.set(0, sellerName);
            }
            catch (error) {
                this.logger.warn(`seller name unavailable: ${error.message}`);
            }
        }
        return names;
    }
    async queryProposalFunnel(from, to) {
        const rows = await this.proposals.findAll({
            where: inRange('created_at', from, to),
            attributes: ['vpbx_user_uid', 'status'],
        });
        const grouped = new Map();
        for (const row of rows) {
            const tenantUid = Number(row.vpbx_user_uid);
            const current = grouped.get(tenantUid) ?? {
                tenantUid,
                pending: 0,
                applied: 0,
                rejected: 0,
                denied: 0,
            };
            if (row.status === 'pending')
                current.pending += 1;
            else if (row.status === 'applied')
                current.applied += 1;
            else if (row.status === 'rejected')
                current.rejected += 1;
            else if (row.status === 'denied')
                current.denied += 1;
            grouped.set(tenantUid, current);
        }
        return [...grouped.values()].sort((a, b) => a.tenantUid - b.tenantUid);
    }
    async queryToolErrors(from, to) {
        const rows = await this.audit.findAll({
            where: inRange('created_at', from, to),
            attributes: ['user_uid', 'tool_name', 'status'],
        });
        const grouped = new Map();
        for (const row of rows) {
            const tenantUid = Number(row.user_uid);
            const key = `${tenantUid}\0${row.tool_name}\0${row.status}`;
            const current = grouped.get(key) ?? {
                tenantUid,
                toolName: row.tool_name,
                status: row.status,
                count: 0,
            };
            current.count += 1;
            grouped.set(key, current);
        }
        return [...grouped.values()].sort((a, b) => a.tenantUid - b.tenantUid || a.toolName.localeCompare(b.toolName));
    }
    async detectSilentWrites(from, to) {
        const auditRows = await this.audit.findAll({
            where: inRange('created_at', from, to),
            attributes: ['uid', 'user_uid', 'thread_uid', 'tool_name', 'created_at'],
        });
        const applied = await this.proposals.findAll({
            where: { status: 'applied' },
            attributes: ['vpbx_user_uid', 'thread_uid', 'status', 'applied_at'],
        });
        const hits = [];
        for (const row of auditRows) {
            if (!isMutatingTool(row.tool_name))
                continue;
            const matched = applied.some((proposal) => proposal.status === 'applied' &&
                Number(proposal.vpbx_user_uid) === Number(row.user_uid) &&
                (row.thread_uid == null || Number(proposal.thread_uid) === Number(row.thread_uid)));
            if (matched)
                continue;
            const hit = {
                tenantUid: Number(row.user_uid),
                toolName: row.tool_name,
                auditUid: Number(row.uid),
            };
            hits.push(hit);
            this.logger.error(`silent write: tenant=${hit.tenantUid} tool=${hit.toolName} audit=${hit.auditUid}`);
        }
        return hits;
    }
    async getDefaultModel() {
        const rows = await this.providers.findAll({
            attributes: ['uid', 'name', 'defaults', 'capabilities', 'enabled'],
        });
        const providers = rows
            .filter((row) => row.enabled && Array.isArray(row.capabilities) && row.capabilities.includes('llm'))
            .map((row) => ({
            uid: row.uid,
            name: row.name,
            model: typeof row.defaults?.model === 'string' ? row.defaults.model : null,
        }));
        const stored = this.settings
            ? await this.settings.findOne({ where: { user_uid: 0 } })
            : null;
        const raw = stored?.settings?.defaultProviderUid;
        const providerUid = typeof raw === 'number' ? raw : null;
        return { providerUid, providers };
    }
    async setDefaultModel(providerUid) {
        const [row] = await this.settings.findOrCreate({
            where: { user_uid: 0 },
            defaults: { user_uid: 0, confirm_destructive: 0, settings: {} },
        });
        const next = { ...(row.settings ?? {}), defaultProviderUid: providerUid };
        await row.update({ settings: next });
        return this.getDefaultModel();
    }
    async tickSilentWrites() {
        if (this.runningSilent)
            return;
        this.runningSilent = true;
        try {
            const to = new Date();
            const from = new Date(to.getTime() - SILENT_WRITE_WINDOW_MS);
            await this.detectSilentWrites(from, to);
        }
        catch (error) {
            this.logger.warn(`silent-write scan: ${error.message}`);
        }
        finally {
            this.runningSilent = false;
        }
    }
};
exports.AgentUsageService = AgentUsageService;
__decorate([
    (0, schedule_1.Interval)('agent-silent-write', SILENT_WRITE_INTERVAL_MS),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", Promise)
], AgentUsageService.prototype, "tickSilentWrites", null);
exports.AgentUsageService = AgentUsageService = AgentUsageService_1 = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, sequelize_1.InjectModel)(agent_thread_model_1.AgentThread)),
    __param(1, (0, sequelize_1.InjectModel)(ai_provider_model_1.CcAiProvider)),
    __param(2, (0, sequelize_1.InjectModel)(agent_proposal_model_1.AgentProposal)),
    __param(3, (0, sequelize_1.InjectModel)(ai_audit_log_model_1.CcAiAuditLog)),
    __param(4, (0, sequelize_1.InjectModel)(ai_chat_settings_model_1.AiChatSettings)),
    __param(5, (0, sequelize_1.InjectModel)(tenant_model_1.Tenant)),
    __param(6, (0, sequelize_1.InjectModel)(cloud_setting_model_1.CloudSetting)),
    __metadata("design:paramtypes", [Object, Object, Object, Object, Object, Object, Object])
], AgentUsageService);
//# sourceMappingURL=agent-usage.service.js.map