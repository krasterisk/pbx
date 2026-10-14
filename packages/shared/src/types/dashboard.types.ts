/** Bounded PBX dashboard contract. Tenant identity is never client input. */
export type DashboardSourceState = 'ok' | 'stale' | 'unavailable' | 'notConfigured';
export interface DashboardSource { state: DashboardSourceState; updatedAt: string | null; message?: string; progress?: { percent: number | null } }
export type DashboardDirection = 'in' | 'out' | 'internal' | 'external';
export type DashboardOutcome = 'accepted' | 'missed' | 'unknown' | 'active';
export type DashboardOrigin = 'telephony' | 'autodial' | 'ai';
export interface DashboardPeriod { from: string; to: string; timezone: string }
export interface DashboardQuery { version?: string; state?: 'ringing' | 'talking' | 'waiting'; status?: 'online' | 'offline' | 'unknown'; period?: 'today' | 'yesterday' | '7d' | '30d' | 'custom'; from?: string; to?: string; direction?: DashboardDirection; outcome?: DashboardOutcome; origin?: DashboardOrigin; search?: string; cursor?: string; limit?: number }
export interface DashboardTotals { total: number; incoming: number; outgoing: number; internal: number; external: number; accepted: number; missed: number; unknown: number }
export interface DashboardBucket extends DashboardTotals { at: string; until?: string }
export interface DashboardWarning { code: string; severity: 'warning' | 'critical'; count: number; target: 'calls' | 'endpoints' | 'trunks' | 'system' | 'cloud' }
export interface DashboardLive { activeCalls: number; ringing: number; talking: number; waiting: number; endpoints: { online: number; total: number; unknown: number }; trunks: { online: number; total: number; unknown: number }; source: DashboardSource; callsSource?: DashboardSource; inventorySource?: DashboardSource }
export interface DashboardCloud { source: DashboardSource; billingSource?: DashboardSource; usageSource?: DashboardSource; planName: string | null; expiresAt: string | null; balanceKopecks: number | null; creditLimitKopecks: number | null; blocked: boolean; limits: { extensions: number | null; trunks: number | null; queues: number | null; concurrentCalls: number | null }; usage: { extensions: number; trunks: number; queues: number; concurrentCalls: number } }
export interface DashboardSystemSample { at: string; cpu: number | null; memory: number | null; load: number | null; uptime: number | null; networkRx: number | null; networkTx: number | null; missingFilesystems?: string[]; omittedDisks?: number; omittedMissingFilesystems?: number; disks: { mount: string; usedPercent: number; availableBytes: number }[] }
export interface DashboardSystemNode { id: string; label: string; role: 'asterisk' | 'application'; source: DashboardSource; current: DashboardSystemSample | null }
export interface DashboardSystemResponse { nodes: DashboardSystemNode[]; history?: { at: string; cpu: number | null; cpuMax: number | null; memory: number | null; memoryMax: number | null }[] }
export interface DashboardOverview { deploymentMode: 'box' | 'cloud' | 'opensource'; version: string; historyVersion?: string; period: DashboardPeriod; live: DashboardLive; totals: DashboardTotals; buckets: DashboardBucket[]; historySource: DashboardSource; warnings: DashboardWarning[]; warningCount: number; cloud?: DashboardCloud; system?: DashboardSystemNode[] }
export interface DashboardCall { id: string; linkedid: string; startedAt: string; endedAt: string | null; src: string; dst: string; direction: DashboardDirection; origin: DashboardOrigin; outcome: DashboardOutcome; reason: string | null; duration: number; state?: string }
export interface DashboardEndpoint { id: string; name: string; status: 'online' | 'offline' | 'unknown'; enabled: boolean }
export interface DashboardPage<T> { rows: T[]; total: number; nextCursor: string | null; version: string; source: DashboardSource }
export const DASHBOARD_LIMITS = { pageSize: 50, maxPageSize: 100, maxBuckets: 300, maxOverviewBytes: 50 * 1024, maxPeriodDays: 31 } as const;
