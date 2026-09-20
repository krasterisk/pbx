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
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
var AriHttpClientService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.AriHttpClientService = exports.AriRequestError = void 0;
const common_1 = require("@nestjs/common");
const config_1 = require("@nestjs/config");
const axios_1 = __importDefault(require("axios"));
const ari_app_name_1 = require("./ari-app-name");
/**
 * Compact error thrown by ARI HTTP requests.
 * Strips Axios internals (TLS sockets, buffers) to keep logs readable.
 */
class AriRequestError extends Error {
    method;
    url;
    status;
    responseBody;
    originalMessage;
    constructor(method, url, status, responseBody, originalMessage) {
        const statusStr = status ? ` ${status}` : '';
        super(`ARI ${method.toUpperCase()}${statusStr} ${url}: ${originalMessage}`);
        this.method = method;
        this.url = url;
        this.status = status;
        this.responseBody = responseBody;
        this.originalMessage = originalMessage;
        this.name = 'AriRequestError';
    }
}
exports.AriRequestError = AriRequestError;
let AriHttpClientService = AriHttpClientService_1 = class AriHttpClientService {
    configService;
    logger = new common_1.Logger(AriHttpClientService_1.name);
    client;
    baseURL;
    appName;
    autodialAppName;
    constructor(configService) {
        this.configService = configService;
    }
    onModuleInit() {
        const protocol = this.configService.get('ARI_PROTOCOL', 'http');
        const host = this.configService.get('ARI_HOST', 'localhost');
        const port = this.configService.get('ARI_PORT', 8088);
        const username = this.configService.get('ARI_USER', 'krasterisk');
        const password = this.configService.get('ARI_PASSWORD', '');
        this.baseURL = `${protocol}://${host}:${port}/ari`;
        const appNames = (0, ari_app_name_1.resolveAriApplicationNames)({
            scriptedVoiceRobots: this.configService.get('ARI_APP_NAME'),
            autodial: this.configService.get('ARI_AUTODIAL_APP_NAME'),
        });
        this.appName = appNames.scriptedVoiceRobots;
        this.autodialAppName = appNames.autodial;
        this.client = axios_1.default.create({
            baseURL: this.baseURL,
            auth: { username, password },
            headers: {
                'Content-Type': 'application/json',
            },
            timeout: 10000,
        });
        // ─── Compact error interceptor ───
        // Strips Axios internals (TLS sockets, Buffers, circular refs)
        // so error logs stay readable instead of dumping megabytes.
        this.client.interceptors.response.use((response) => response, (error) => {
            const method = error.config?.method || 'UNKNOWN';
            const url = error.config?.url || 'unknown';
            const status = error.response?.status ?? null;
            const body = error.response?.data;
            const msg = error.message || 'Unknown error';
            return Promise.reject(new AriRequestError(method, url, status, body, msg));
        });
        this.logger.log(`Initialized ARI HTTP Client (baseURL: ${this.baseURL}, apps: ${this.getEventAppNames().join(',')})`);
    }
    // ==================== Connection Test ====================
    async testConnection() {
        try {
            const response = await this.client.get('/asterisk/info');
            return response.status === 200;
        }
        catch (error) {
            this.logger.error(`ARI connection test failed: ${error.message}`);
            return false;
        }
    }
    // ==================== Bridge Operations ====================
    async createBridge(type = 'mixing') {
        const response = await this.client.post('/bridges', undefined, { params: { type } });
        return response.data;
    }
    async addChannelToBridge(bridgeId, channelId) {
        await this.client.post(`/bridges/${bridgeId}/addChannel`, undefined, {
            params: { channel: channelId },
        });
    }
    async removeChannelFromBridge(bridgeId, channelId) {
        await this.client.post(`/bridges/${bridgeId}/removeChannel`, undefined, {
            params: { channel: channelId },
        });
    }
    async destroyBridge(bridgeId) {
        await this.client.delete(`/bridges/${bridgeId}`);
    }
    async getBridge(bridgeId) {
        const response = await this.client.get(`/bridges/${bridgeId}`);
        return response.data;
    }
    async snoopChannel(channelId, app, appArgs, spy = 'none', whisper = 'out') {
        const response = await this.client.post(`/channels/${channelId}/snoop`, undefined, {
            params: { app, appArgs, spy, whisper },
        });
        return response.data;
    }
    // ==================== Channel Operations ====================
    async createChannel(endpoint, app, appArgs) {
        const response = await this.client.post('/channels/create', undefined, {
            params: { endpoint, app, appArgs: appArgs || '' },
        });
        return response.data;
    }
    /**
     * Originate with a caller-supplied id so events can be correlated before
     * the request. Caller ID must be an originate parameter: setting only the
     * CALLERID(num) channel variable after /channels/create leaves the SIP
     * identity anonymous on the tested Asterisk/PJSIP path.
     */
    async originateChannel(params) {
        const query = {
            endpoint: params.endpoint,
            app: params.app,
            appArgs: params.appArgs || '',
            channelId: params.channelId,
        };
        if (params.timeout != null)
            query.timeout = params.timeout;
        if (params.callerId)
            query.callerId = params.callerId;
        const response = await this.client.post('/channels', params.variables && Object.keys(params.variables).length
            ? { variables: params.variables }
            : undefined, { params: query });
        return response.data;
    }
    /** Start dialing a channel previously created with /channels/create. */
    async dialChannel(channelId, timeout) {
        const params = {};
        if (timeout != null)
            params.timeout = timeout;
        await this.client.post(`/channels/${channelId}/dial`, undefined, { params });
    }
    async continueChannel(channelId) {
        await this.client.post(`/channels/${channelId}/continue`);
    }
    async continueInDialplan(channelId, context, extension, priority) {
        const params = {};
        if (context)
            params.context = context;
        if (extension)
            params.extension = extension;
        if (priority)
            params.priority = priority;
        const target = context ? `${extension}@${context}:${priority}` : '(default dialplan)';
        this.logger.debug(`[ARI] continueInDialplan channel=${channelId} → ${target}`);
        try {
            await this.client.post(`/channels/${channelId}/continue`, undefined, { params });
        }
        catch (e) {
            this.logger.error(`[ARI] continueInDialplan FAILED: ${e.message}`);
            throw e;
        }
    }
    async setChannelVar(channelId, variable, value) {
        await this.client.post(`/channels/${channelId}/variable`, undefined, {
            params: { variable, value },
        });
    }
    async answerChannel(channelId) {
        await this.client.post(`/channels/${channelId}/answer`);
    }
    async hangupChannel(channelId, reason = 'normal') {
        await this.client.delete(`/channels/${channelId}`, { params: { reason } });
    }
    async getChannel(channelId) {
        const response = await this.client.get(`/channels/${channelId}`);
        return response.data;
    }
    async redirectChannel(channelId, context, extension, priority = 1) {
        await this.client.post(`/channels/${channelId}/redirect`, undefined, {
            params: { context, extension, priority },
        });
    }
    async playMedia(channelId, media, lang = 'ru') {
        const response = await this.client.post(`/channels/${channelId}/play`, undefined, {
            params: { media: `sound:${media}`, lang },
        });
        return response.data.id;
    }
    async stopPlayback(playbackId) {
        await this.client.delete(`/playbacks/${playbackId}`);
    }
    // ==================== External Media ====================
    /**
     * Create an ExternalMedia channel for RTP streaming.
     *
     * @param channelId - Optional ID for the new channel (null = Asterisk assigns UUID)
     * @param app - Stasis application name
     * @param externalHost - Host:port where Asterisk sends RTP (e.g. '127.0.0.1:12000')
     * @param format - Audio format ('alaw', 'ulaw', 'slin16')
     * @param data - Optional metadata passed as args to StasisStart (e.g. parent channelId)
     */
    async externalMedia(channelId, app, externalHost, format = 'alaw', data) {
        const params = {
            app,
            external_host: externalHost,
            format,
        };
        if (channelId)
            params.channelId = channelId;
        if (data)
            params.data = data;
        const response = await this.client.post(`/channels/externalMedia`, undefined, { params });
        return response.data;
    }
    // ==================== Utility Methods ====================
    async getAsteriskInfo() {
        const response = await this.client.get('/asterisk/info');
        return response.data;
    }
    getBaseUrl() {
        return this.baseURL;
    }
    getAppName() {
        return this.appName;
    }
    /** Explicit name for autodial originates; do not use the scripted app. */
    getAutodialAppName() {
        return this.autodialAppName;
    }
    /** The single inbound WebSocket subscribes to each currently active owner. */
    getEventAppNames() {
        return [this.appName, this.autodialAppName];
    }
};
exports.AriHttpClientService = AriHttpClientService;
exports.AriHttpClientService = AriHttpClientService = AriHttpClientService_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [config_1.ConfigService])
], AriHttpClientService);
//# sourceMappingURL=ari-http-client.service.js.map