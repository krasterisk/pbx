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
   * DeviceState → presence (D-36/D-37).
   * Accepts both lowercased (asterisk-manager) and AMI PascalCase Device/State.
   * Tenant is parsed from the device identifier's `_<uid>` suffix.
   */
  handleDeviceStateChange(evt: any): void {
    const device = String(evt?.device || evt?.Device || '').trim();
    if (!device) return;

    const userUid = CallCenterAmiService.parseQueueTenant(device);
    if (userUid == null) return;

    const extension = interfaceToExtension(device);
    const state = String(evt?.state || evt?.State || '').trim();
    this.scheduleUpdate(userUid, { device, extension, state });
  }

  /**
   * ExtensionState (hint-based BLF) → presence (D-36/D-37).
   * Accepts Exten/Context/StatusText/Status casing variants.
   */
  handleExtensionStatus(evt: any): void {
    const exten = String(evt?.exten || evt?.Exten || '').trim();
    if (!exten) return;

    const context = String(evt?.context || evt?.Context || '').trim();
    const userUid = CallCenterAmiService.parseQueueTenant(context || exten);
    if (userUid == null) return;

    this.scheduleUpdate(userUid, {
      device: exten,
      extension: exten,
      state: String(evt?.statustext || evt?.StatusText || evt?.status || evt?.Status || '').trim(),
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

  /**
   * Cache updates immediately so getPresence / registration-state polls are fresh;
   * only the SSE `presenceUpdate` emit is debounced (D-45/Pitfall 8).
   */
  private scheduleUpdate(userUid: number, entry: PresenceEntry): void {
    const key = this.presenceKey(userUid, entry.extension);
    this.presence.set(key, entry);

    const existingTimer = this.pending.get(key);
    if (existingTimer) clearTimeout(existingTimer);

    this.pending.set(
      key,
      setTimeout(() => {
        this.pending.delete(key);
        // Re-read latest cache entry in case a newer state arrived during the window.
        const latest = this.presence.get(key) ?? entry;
        this.stateService.emitEvent('presenceUpdate', userUid, {
          device: latest.device,
          extension: latest.extension,
          state: latest.state,
        });
      }, PRESENCE_DEBOUNCE_MS),
    );
  }
}
