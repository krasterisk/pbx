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
var CallCenterPresenceService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.CallCenterPresenceService = exports.PRESENCE_DEBOUNCE_MS = void 0;
/**
 * CallCenter Presence (BLF) Service.
 *
 * Subscribes to AMI DeviceState/ExtensionState events (registered in
 * ami.service.ts's connect() block, forwarded via ModuleRef like the other
 * CC AMI handlers) and republishes them as debounced `presenceUpdate` SSE
 * deltas (D-36/D-37/D-45) — never a full-state rebroadcast.
 */
const common_1 = require("@nestjs/common");
const callcenter_state_service_1 = require("./callcenter-state.service");
const callcenter_ami_service_1 = require("./callcenter-ami.service");
const endpoint_ids_util_1 = require("../endpoints/endpoint-ids.util");
/**
 * Coalescing window for high-frequency DeviceState/ExtensionState bursts
 * (D-45, RESEARCH Pitfall 8). 250-500ms range per plan — 300ms chosen as a
 * fixed, documented constant.
 */
exports.PRESENCE_DEBOUNCE_MS = 300;
let CallCenterPresenceService = CallCenterPresenceService_1 = class CallCenterPresenceService {
    stateService;
    logger = new common_1.Logger(CallCenterPresenceService_1.name);
    /** Latest known presence per tenant+extension. Key = `${userUid}:${extension}` */
    presence = new Map();
    /** Pending debounced emits awaiting their coalescing window. Key = same as presence. */
    pending = new Map();
    constructor(stateService) {
        this.stateService = stateService;
    }
    /**
     * DeviceState → presence (D-36/D-37).
     * Accepts both lowercased (asterisk-manager) and AMI PascalCase Device/State.
     * Tenant is parsed from the device identifier's `_<uid>` suffix.
     */
    handleDeviceStateChange(evt) {
        const device = String(evt?.device || evt?.Device || '').trim();
        if (!device)
            return;
        const userUid = callcenter_ami_service_1.CallCenterAmiService.parseQueueTenant(device);
        if (userUid == null)
            return;
        const extension = (0, endpoint_ids_util_1.interfaceToExtension)(device);
        const state = String(evt?.state || evt?.State || '').trim();
        this.scheduleUpdate(userUid, { device, extension, state });
    }
    /**
     * ExtensionState (hint-based BLF) → presence (D-36/D-37).
     * Accepts Exten/Context/StatusText/Status casing variants.
     */
    handleExtensionStatus(evt) {
        const exten = String(evt?.exten || evt?.Exten || '').trim();
        if (!exten)
            return;
        const context = String(evt?.context || evt?.Context || '').trim();
        const userUid = callcenter_ami_service_1.CallCenterAmiService.parseQueueTenant(context || exten);
        if (userUid == null)
            return;
        this.scheduleUpdate(userUid, {
            device: exten,
            extension: exten,
            state: String(evt?.statustext || evt?.StatusText || evt?.status || evt?.Status || '').trim(),
        });
    }
    /** Current presence snapshot for a tenant (TransferDirectory initial render, Task 3). */
    getPresenceForTenant(userUid) {
        const prefix = `${userUid}:`;
        const result = [];
        for (const [key, entry] of this.presence) {
            if (key.startsWith(prefix))
                result.push(entry);
        }
        return result;
    }
    /** Look up a single extension's current state (Task 3 directory enrichment). */
    getPresence(userUid, extension) {
        return this.presence.get(this.presenceKey(userUid, extension))?.state;
    }
    presenceKey(userUid, extension) {
        return `${userUid}:${extension}`;
    }
    /**
     * Cache updates immediately so getPresence / registration-state polls are fresh;
     * only the SSE `presenceUpdate` emit is debounced (D-45/Pitfall 8).
     */
    scheduleUpdate(userUid, entry) {
        const key = this.presenceKey(userUid, entry.extension);
        this.presence.set(key, entry);
        const existingTimer = this.pending.get(key);
        if (existingTimer)
            clearTimeout(existingTimer);
        this.pending.set(key, setTimeout(() => {
            this.pending.delete(key);
            // Re-read latest cache entry in case a newer state arrived during the window.
            const latest = this.presence.get(key) ?? entry;
            this.stateService.emitEvent('presenceUpdate', userUid, {
                device: latest.device,
                extension: latest.extension,
                state: latest.state,
            });
        }, exports.PRESENCE_DEBOUNCE_MS));
    }
};
exports.CallCenterPresenceService = CallCenterPresenceService;
exports.CallCenterPresenceService = CallCenterPresenceService = CallCenterPresenceService_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [callcenter_state_service_1.CallCenterStateService])
], CallCenterPresenceService);
//# sourceMappingURL=callcenter-presence.service.js.map