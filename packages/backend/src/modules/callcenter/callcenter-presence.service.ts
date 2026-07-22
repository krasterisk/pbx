/**
 * CallCenter Presence (BLF) Service.
 *
 * Subscribes to AMI DeviceState/ExtensionState events (registered in
 * ami.service.ts's connect() block, forwarded via ModuleRef like the other
 * CC AMI handlers) and republishes them as debounced `presenceUpdate` SSE
 * deltas (D-36/D-37/D-45) — never a full-state rebroadcast.
 */
import { Injectable, Logger } from '@nestjs/common';
import { CallCenterStateService } from './callcenter-state.service';
import { CallCenterAmiService } from './callcenter-ami.service';
import { interfaceToExtension } from '../endpoints/endpoint-ids.util';

/**
 * Coalescing window for high-frequency DeviceState/ExtensionState bursts
 * (D-45, RESEARCH Pitfall 8). 250-500ms range per plan — 300ms chosen as a
 * fixed, documented constant.
 */
export const PRESENCE_DEBOUNCE_MS = 300;

export interface PresenceEntry {
  device: string;
  extension: string;
  state: string;
}

@Injectable()
export class CallCenterPresenceService {
  private readonly logger = new Logger(CallCenterPresenceService.name);

  /** Latest known presence per tenant+extension. Key = `${userUid}:${extension}` */
  private readonly presence = new Map<string, PresenceEntry>();

  /** Pending debounced emits awaiting their coalescing window. Key = same as presence. */
  private readonly pending = new Map<string, ReturnType<typeof setTimeout>>();

  constructor(private readonly stateService: CallCenterStateService) {}

  /**
   * DeviceState → presence (D-36/D-37). [ASSUMED] `evt.device` / `evt.state`
   * field names follow asterisk-manager's DeviceStateChange event shape;
   * tenant is parsed from the device identifier's `_<uid>` suffix (same
   * convention as endpoint SIP ids / queue names — CallCenterAmiService.
   * parseQueueTenant). Verify against a live Asterisk instance
   * (09-VALIDATION) — field casing/values are unconfirmed.
   */
  handleDeviceStateChange(evt: any): void {
    const device = evt?.device || '';
    if (!device) return;

    const userUid = CallCenterAmiService.parseQueueTenant(device);
    if (userUid == null) return;

    const extension = interfaceToExtension(device);
    this.scheduleUpdate(userUid, { device, extension, state: evt.state || '' });
  }

  /**
   * ExtensionState (hint-based BLF) → presence (D-36/D-37). [ASSUMED]
   * `evt.exten` / `evt.context` / `evt.status` field names — asterisk-manager's
   * ExtensionStatus event shape is unconfirmed against a live instance
   * (09-VALIDATION). Tenant is parsed from the dialplan context's `_<uid>`
   * suffix, same convention as queue/device tenant resolution.
   */
  handleExtensionStatus(evt: any): void {
    const exten = evt?.exten || '';
    if (!exten) return;

    const userUid = CallCenterAmiService.parseQueueTenant(evt.context || exten);
    if (userUid == null) return;

    this.scheduleUpdate(userUid, {
      device: exten,
      extension: exten,
      state: evt.statustext || evt.status || '',
    });
  }

  /** Current presence snapshot for a tenant (TransferDirectory initial render, Task 3). */
  getPresenceForTenant(userUid: number): PresenceEntry[] {
    const prefix = `${userUid}:`;
    const result: PresenceEntry[] = [];
    for (const [key, entry] of this.presence) {
      if (key.startsWith(prefix)) result.push(entry);
    }
    return result;
  }

  /** Look up a single extension's current state (Task 3 directory enrichment). */
  getPresence(userUid: number, extension: string): string | undefined {
    return this.presence.get(this.presenceKey(userUid, extension))?.state;
  }

  private presenceKey(userUid: number, extension: string): string {
    return `${userUid}:${extension}`;
  }

  /** Debounce/coalesce rapid bursts for the same extension before emitting (D-45/Pitfall 8). */
  private scheduleUpdate(userUid: number, entry: PresenceEntry): void {
    const key = this.presenceKey(userUid, entry.extension);
    const existingTimer = this.pending.get(key);
    if (existingTimer) clearTimeout(existingTimer);

    this.pending.set(
      key,
      setTimeout(() => {
        this.pending.delete(key);
        this.presence.set(key, entry);
        this.stateService.emitEvent('presenceUpdate', userUid, {
          device: entry.device,
          extension: entry.extension,
          state: entry.state,
        });
      }, PRESENCE_DEBOUNCE_MS),
    );
  }
}
