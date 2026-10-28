import * as net from 'net';
import { assertDevelopmentPortAvailable } from './development-port';

const listen = (server: net.Server) =>
  new Promise<number>((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, () => resolve((server.address() as net.AddressInfo).port));
  });
const close = (server: net.Server) =>
  new Promise<void>((resolve, reject) =>
    server.close((error) => (error ? reject(error) : resolve())),
  );

describe('Local backend development port ownership', () => {
  it('rejects a duplicate startup while leaving the original server alive and reachable', async () => {
    const server = net.createServer((client) => client.end('original server'));
    const port = await listen(server);
    try {
      await expect(assertDevelopmentPortAvailable(port)).rejects.toThrow(
        `Backend port ${port} is already in use`,
      );
      expect(server.listening).toBe(true);
      const message = await new Promise<string>((resolve, reject) => {
        let body = '';
        const client = net.connect(port);
        client.on('error', reject);
        client.on('data', (data) => {
          body += data;
        });
        client.on('end', () => resolve(body));
      });
      expect(message).toBe('original server');
    } finally {
      await close(server);
    }
  });

  it('releases its own probe so a normal server can bind the free port', async () => {
    const server = net.createServer();
    const port = await listen(server);
    await close(server);
    await assertDevelopmentPortAvailable(port);
    await new Promise<void>((resolve, reject) => {
      server.once('error', reject);
      server.listen(port, resolve);
    });
    await close(server);
  });
});
