import { createServer, type Server } from 'node:http';
import { AddressInfo } from 'node:net';
import { ConfigService } from '@nestjs/config';
import { Sequelize } from 'sequelize-typescript';
import { DashboardReadStore } from './dashboard-read-store.service';
import { DashboardSystemService } from './dashboard-system.service';

class ExposedSystem extends DashboardSystemService {
  read(url: string) { return this.fetchExporter(url); }
}

describe('exporter HTTP budgets', () => {
  let server: Server; let url: string;
  const service = new ExposedSystem({} as Sequelize, { get: () => 'CLOUD' } as unknown as ConfigService, {} as DashboardReadStore);
  beforeAll(async () => {
    server = createServer((req, res) => {
      if (req.url === '/ok') { res.end('node_memory_MemTotal_bytes 1000'); return; }
      if (req.url === '/redirect') { res.writeHead(302, { Location: '/ok' }); res.end(); return; }
      if (req.url === '/huge') { res.end(Buffer.alloc(2 * 1024 * 1024 + 1)); return; }
      // Drip keeps the socket busy; idle timeout alone cannot protect collection.
      res.writeHead(200); res.write('# waiting\n');
      const timer = setInterval(() => res.write('# waiting\n'), 250);
      res.on('close', () => clearInterval(timer));
    });
    await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
    url = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  });
  afterAll(async () => { await new Promise<void>((resolve) => server.close(() => resolve())); });
  it('accepts plain metrics but never follows redirects', async () => {
    expect(await service.read(`${url}/ok`)).toContain('MemTotal');
    await expect(service.read(`${url}/redirect`)).rejects.toThrow('HTTP failure');
  });
  it('rejects oversized responses', async () => {
    await expect(service.read(`${url}/huge`)).rejects.toThrow('body limit');
  });
  it('enforces an absolute deadline even for an active socket', async () => {
    await expect(service.read(`${url}/drip`)).rejects.toThrow('deadline');
  }, 10_000);
});
