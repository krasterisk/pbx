type SoftphoneParkFn = () => void | Promise<void>;

let unregisterFn: SoftphoneParkFn | null = null;
let restoreFn: SoftphoneParkFn | null = null;

export function bindSoftphonePark(unregister: SoftphoneParkFn, restore: SoftphoneParkFn): void {
  unregisterFn = unregister;
  restoreFn = restore;
}

export function unbindSoftphonePark(): void {
  unregisterFn = null;
  restoreFn = null;
}

export async function unregisterLiveSoftphone(): Promise<void> {
  await unregisterFn?.();
}

export async function restoreLiveSoftphone(): Promise<void> {
  await restoreFn?.();
}
