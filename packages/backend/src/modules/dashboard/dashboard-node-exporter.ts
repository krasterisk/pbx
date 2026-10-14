import type { DashboardSystemSample } from '@krasterisk/shared';

export interface ExporterCounters { cpuTotal: number | null; cpuIdle: number | null; cores: number; rx: number | null; tx: number | null; boot: number | null }
export interface ParsedExporter { sample: DashboardSystemSample; counters: ExporterCounters }
interface Metric { name: string; labels: Record<string, string>; value: number }
const ALLOWED = /^(?:node_cpu_seconds_total|node_memory_MemTotal_bytes|node_memory_MemAvailable_bytes|node_load1|node_boot_time_seconds|node_filesystem_size_bytes|node_filesystem_avail_bytes|node_network_receive_bytes_total|node_network_transmit_bytes_total)(?:\{|\s)/;
const validPercent = (value: number): number | null => Number.isFinite(value) && value >= 0 ? Math.min(100, value) : null;

function metric(line: string): Metric | null {
  if (!ALLOWED.test(line)) return null;
  const match = /^([a-zA-Z_:][\w:]*)(?:\{(.*)\})?\s+([^\s]+)(?:\s+[^\s]+)?$/.exec(line);
  if (!match) return null;
  const value = Number(match[3]);
  if (!Number.isFinite(value)) return null;
  const labels: Record<string, string> = {};
  for (const label of (match[2] ?? '').matchAll(/(\w+)="((?:\\.|[^"\\])*)"/g)) {
    try { labels[label[1]] = JSON.parse(`"${label[2]}"`) as string; }
    catch { return null; }
  }
  return { name: match[1], labels, value };
}

/** Fixed metric whitelist and bounded disk list; no per-subscriber series. */
export function parseNodeExporter(body: string, at: number, recordsMount?: string, previous?: ParsedExporter, selectedFilesystems?: readonly string[]): ParsedExporter {
  if (Buffer.byteLength(body) > 2 * 1024 * 1024) throw new Error('Exporter body limit exceeded');
  let total = 0; let idle = 0; let cpuSeen = false;
  const cores = new Set<string>();
  let memoryTotal: number | null = null; let available: number | null = null;
  let load: number | null = null; let boot: number | null = null;
  let rx: number | null = null; let tx: number | null = null;
  const filesystems = new Map<string, { size?: number; available?: number; mount: string }>();
  for (const line of body.split('\n')) {
    const item = metric(line.trim());
    if (!item) continue;
    const { name, labels, value } = item;
    if (name === 'node_cpu_seconds_total' && labels.cpu && labels.mode && !['guest', 'guest_nice'].includes(labels.mode)) {
      if (value < 0) continue;
      cpuSeen = true; total += value;
      if (labels.mode === 'idle' || labels.mode === 'iowait') idle += value;
      if (labels.mode === 'idle') cores.add(labels.cpu);
    } else if (name === 'node_memory_MemTotal_bytes') memoryTotal = value;
    else if (name === 'node_memory_MemAvailable_bytes') available = value;
    else if (name === 'node_load1') load = value;
    else if (name === 'node_boot_time_seconds') boot = value;
    else if (name.startsWith('node_network_')) {
      if (!labels.device || /^(?:lo$|veth|docker|br-|cni|tun|tap)/.test(labels.device) || value < 0) continue;
      if (name === 'node_network_receive_bytes_total') rx = (rx ?? 0) + value;
      else tx = (tx ?? 0) + value;
    } else if (name.startsWith('node_filesystem_')) {
      const mount = labels.mountpoint;
      if (!mount || mount.length > 255 || /^(?:tmpfs|devtmpfs|overlay|squashfs|nsfs|proc|sysfs|ramfs|autofs|cgroup2?)$/.test(labels.fstype ?? '')) continue;
      const key = `${labels.device}:${mount}`;
      const row = filesystems.get(key) ?? { mount };
      if (name === 'node_filesystem_size_bytes') row.size = value;
      else row.available = value;
      filesystems.set(key, row);
    }
  }
  if (!cpuSeen && memoryTotal === null && filesystems.size === 0) throw new Error('Exporter has no host metrics');
  const counters: ExporterCounters = { cpuTotal: cpuSeen ? total : null, cpuIdle: cpuSeen ? idle : null, cores: cores.size, rx, tx, boot };
  const elapsed = previous ? (at - Date.parse(previous.sample.at)) / 1000 : 0;
  const previousCounters = previous?.counters;
  const continuous = elapsed > 0 && elapsed <= 45 && previousCounters?.boot === boot;
  let cpu: number | null = null;
  if (continuous && cpuSeen && previousCounters && previousCounters.cores === cores.size && previousCounters.cpuTotal !== null && previousCounters.cpuIdle !== null) {
    const totalDelta = total - previousCounters.cpuTotal;
    const idleDelta = idle - previousCounters.cpuIdle;
    if (totalDelta > 0 && idleDelta >= 0 && idleDelta <= totalDelta) cpu = validPercent(100 * (1 - idleDelta / totalDelta));
  }
  const rate = (current: number | null, prior: number | null | undefined): number | null =>
    continuous && current !== null && prior !== null && prior !== undefined && current >= prior ? (current - prior) / elapsed : null;
  // Merge duplicate mountpoints and retain the worst observation for that mount.
  const byMount = new Map<string, { mount: string; usedPercent: number; availableBytes: number }>();
  for (const row of filesystems.values()) {
    if (!(row.size! > 0) || row.available === undefined || row.available < 0 || row.available > row.size!) continue;
    const disk = { mount: row.mount, usedPercent: 100 * (1 - row.available / row.size!), availableBytes: row.available };
    if (!byMount.has(disk.mount) || byMount.get(disk.mount)!.usedPercent < disk.usedPercent) byMount.set(disk.mount, disk);
  }
  const required = selectedFilesystems ?? [...new Set(['/', ...(recordsMount ? [recordsMount] : [])])];
  const missingFilesystems = required.filter((mount) => !byMount.has(mount));
  const disks = selectedFilesystems
    ? selectedFilesystems.flatMap((mount) => byMount.has(mount) ? [byMount.get(mount)!] : [])
    : [...byMount.values()].sort((a, b) => {
      const rank = (mount: string) => mount === recordsMount ? 0 : mount === '/' ? 1 : 2;
      return rank(a.mount) - rank(b.mount) || b.usedPercent - a.usedPercent || a.mount.localeCompare(b.mount);
    }).slice(0, 8);
  const sample: DashboardSystemSample = {
    at: new Date(at).toISOString(), cpu,
    memory: memoryTotal !== null && memoryTotal > 0 && available !== null && available >= 0 ? validPercent(100 * (1 - available / memoryTotal)) : null,
    load: load !== null && cores.size > 0 ? load / cores.size : null,
    uptime: boot !== null && boot > 0 && at / 1000 >= boot ? at / 1000 - boot : null,
    networkRx: rate(rx, previousCounters?.rx), networkTx: rate(tx, previousCounters?.tx), disks, missingFilesystems,
  };
  return { sample, counters };
}
