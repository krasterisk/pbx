export type TrunkRegistrationState = 'Registered' | 'Rejected' | 'Unregistered' | 'Stopped' | 'Unknown';

export function trunkRegistrationState(status?: string | null): TrunkRegistrationState {
  switch (status?.trim().toLowerCase()) {
    case 'registered': return 'Registered';
    case 'rejected': return 'Rejected';
    case 'unregistered': return 'Unregistered';
    case 'stopped': return 'Stopped';
    default: return 'Unknown';
  }
}
