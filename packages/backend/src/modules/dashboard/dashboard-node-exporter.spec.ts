import { parseNodeExporter } from './dashboard-node-exporter';
const body = (idle = 100, user = 100, network = 1000, boot = 1000) => `
node_cpu_seconds_total{cpu="0",mode="idle"} ${idle}
node_cpu_seconds_total{cpu="0",mode="user"} ${user}
node_memory_MemTotal_bytes 1000
node_memory_MemAvailable_bytes 100
node_load1 2
node_boot_time_seconds ${boot}
node_filesystem_size_bytes{device="/dev/a",fstype="ext4",mountpoint="/"} 1000
node_filesystem_avail_bytes{device="/dev/a",fstype="ext4",mountpoint="/"} 40
node_filesystem_size_bytes{device="tmpfs",fstype="tmpfs",mountpoint="/tmp"} 1000
node_filesystem_avail_bytes{device="tmpfs",fstype="tmpfs",mountpoint="/tmp"} 0
node_network_receive_bytes_total{device="eth0"} ${network}
node_network_transmit_bytes_total{device="eth0"} ${network}
node_network_receive_bytes_total{device="lo"} 99999
`;

describe('bounded host exporter metrics', () => {
  it('uses counter deltas, MemAvailable and real filesystems', () => {
    const first = parseNodeExporter(body(), 2_000_000);
    expect(first.sample.cpu).toBeNull();
    expect(first.sample.networkRx).toBeNull();
    const next = parseNodeExporter(body(102, 113, 1150), 2_015_000, undefined, first);
    expect(next.sample.cpu).toBeCloseTo(86.6666, 3);
    expect(next.sample.memory).toBe(90);
    expect(next.sample.load).toBe(2);
    expect(next.sample.networkRx).toBe(10);
    expect(next.sample.disks).toEqual([{ mount: '/', usedPercent: 96, availableBytes: 40 }]);
  });
  it('leaves unknown rates on reset, restart and gaps', () => {
    const first = parseNodeExporter(body(), 2_000_000);
    expect(parseNodeExporter(body(1, 2, 1, 2000), 2_015_000, undefined, first).sample.cpu).toBeNull();
    expect(parseNodeExporter(body(1, 2, 1), 2_015_000, undefined, first).sample.cpu).toBeNull();
    expect(parseNodeExporter(body(102, 113, 1150), 2_060_000, undefined, first).sample.networkRx).toBeNull();
  });
  it('bounds body and rejects absent host metrics rather than producing zeros', () => {
    expect(() => parseNodeExporter('process_cpu_seconds_total 42', 2_000_000)).toThrow('no host metrics');
    expect(() => parseNodeExporter('a'.repeat(2 * 1024 * 1024 + 1), 2_000_000)).toThrow('body limit');
  });
  it('keeps at most eight disks and prioritizes recording filesystem', () => {
    const files = Array.from({ length: 30 }, (_, i) => `node_filesystem_size_bytes{device="/dev/${i}",fstype="ext4",mountpoint="/mount/${i}"} 1000\nnode_filesystem_avail_bytes{device="/dev/${i}",fstype="ext4",mountpoint="/mount/${i}"} 100`).join('\n');
    const sample = parseNodeExporter(files, 2_000_000, '/mount/29').sample;
    expect(sample.disks).toHaveLength(8);
    expect(sample.disks[0].mount).toBe('/mount/29');
  });
  it('keeps a critical ninth mount visible ahead of healthy alphabetically earlier mounts', () => {
    const metrics = (mount: string, available: number) => `node_filesystem_size_bytes{device="${mount}",fstype="ext4",mountpoint="${mount}"} 1000\nnode_filesystem_avail_bytes{device="${mount}",fstype="ext4",mountpoint="${mount}"} ${available}`;
    const files = [metrics('/', 900), metrics('/records', 900),
      ...Array.from({ length: 8 }, (_, i) => metrics(`/data/${i}`, 500)), metrics('/zzz-database', 5)].join('\n');
    const sample = parseNodeExporter(files, 2_000_000, '/records').sample;
    expect(sample.disks).toHaveLength(8);
    expect(sample.disks[0].mount).toBe('/records');
    expect(sample.disks[1].mount).toBe('/');
    expect(sample.disks[2]).toMatchObject({ mount: '/zzz-database', usedPercent: 99.5 });
    expect(sample.missingFilesystems).toEqual([]);
  });
  it('selects configured mounts exclusively and exposes missing metrics as unknown', () => {
    const sample = parseNodeExporter(body(), 2_000_000, undefined, undefined, ['/', '/database']).sample;
    expect(sample.disks.map((disk) => disk.mount)).toEqual(['/']);
    expect(sample.missingFilesystems).toEqual(['/database']);
    expect(sample.disks.some((disk) => disk.mount === '/database')).toBe(false);
  });
  it('treats invalid availability as unknown instead of inventing a zero utilization', () => {
    const files = `node_filesystem_size_bytes{device="db",fstype="ext4",mountpoint="/db"} 1000\nnode_filesystem_avail_bytes{device="db",fstype="ext4",mountpoint="/db"} 2000`;
    const sample = parseNodeExporter(files, 2_000_000, undefined, undefined, ['/db']).sample;
    expect(sample.disks).toEqual([]);
    expect(sample.missingFilesystems).toEqual(['/db']);
  });
});
