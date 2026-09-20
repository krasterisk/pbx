"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
var WebhookProvider_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.WebhookProvider = void 0;
exports.resolvePayloadTemplate = resolvePayloadTemplate;
const common_1 = require("@nestjs/common");
const axios_1 = __importDefault(require("axios"));
const notification_provider_interface_1 = require("./notification-provider.interface");
const AXIOS_TIMEOUT_MS = 10_000;
function isHttpUrl(url) {
    try {
        const parsed = new URL(url);
        return parsed.protocol === 'http:' || parsed.protocol === 'https:';
    }
    catch {
        return false;
    }
}
function applyTemplate(value, vars) {
    if (typeof value === 'string') {
        return value.replace(/\{\{(\w+)\}\}/g, (_, key) => vars[key] !== undefined ? vars[key] : '');
    }
    if (Array.isArray(value)) {
        return value.map((v) => applyTemplate(v, vars));
    }
    if (value && typeof value === 'object') {
        const out = {};
        for (const [k, v] of Object.entries(value)) {
            out[k] = applyTemplate(v, vars);
        }
        return out;
    }
    return value;
}
/** Accept object (preferred) or JSON string from legacy / textarea saves. */
function resolvePayloadTemplate(raw) {
    if (raw == null || raw === '')
        return null;
    if (typeof raw === 'object' && !Array.isArray(raw)) {
        return raw;
    }
    if (typeof raw === 'string') {
        const trimmed = raw.trim();
        if (!trimmed)
            return null;
        try {
            const parsed = JSON.parse(trimmed);
            if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
                return parsed;
            }
        }
        catch {
            return null;
        }
    }
    return null;
}
let WebhookProvider = WebhookProvider_1 = class WebhookProvider {
    logger = new common_1.Logger(WebhookProvider_1.name);
    async send(integration, target, message, options) {
        const url = integration.config?.url ??
            integration.credentials?.url ??
            '';
        if (!url || !isHttpUrl(String(url))) {
            this.logger.warn('Webhook send skipped: invalid or non-http(s) URL');
            return { success: false, error: 'invalid_url' };
        }
        const extraVars = options?.extraVars;
        const text = (0, notification_provider_interface_1.trimNotificationMessage)(message);
        const vars = {
            message: text,
            target: target ?? '',
            clid: '',
            exten: '',
            uniqueid: '',
            ...extraVars,
        };
        const template = resolvePayloadTemplate(integration.config?.payload_template);
        const payload = template
            ? applyTemplate(template, vars)
            : {
                message: text,
                clid: vars.clid || null,
                exten: vars.exten || null,
                uniqueid: vars.uniqueid || null,
                ...(target ? { target } : {}),
            };
        const headers = integration.config?.headers ??
            integration.credentials?.headers ??
            {};
        try {
            await axios_1.default.post(String(url), payload, {
                headers,
                timeout: AXIOS_TIMEOUT_MS,
            });
            return { success: true };
        }
        catch (e) {
            this.logger.error(`Webhook send failed: ${e?.message ?? e}`);
            return { success: false, error: e?.message };
        }
    }
};
exports.WebhookProvider = WebhookProvider;
exports.WebhookProvider = WebhookProvider = WebhookProvider_1 = __decorate([
    (0, common_1.Injectable)()
], WebhookProvider);
//# sourceMappingURL=webhook.provider.js.map