import * as net from 'net';

/** A duplicate dev launch must never terminate the server that is already running. */
export function assertDevelopmentPortAvailable(port: number): Promise<void> {
  return new Promise((resolve, reject) => {
    const probe = net.createServer();
    probe.once('error', (error: NodeJS.ErrnoException) => {
      if (error.code === 'EADDRINUSE') {
        reject(
          new Error(
            `Backend port ${port} is already in use. Keep one development watcher running; stop the existing server explicitly before starting another.`,
          ),
        );
      } else {
        reject(error);
      }
    });
    probe.once('listening', () =>
      probe.close((error) => (error ? reject(error) : resolve())),
    );
    probe.listen(port);
  });
}
