/**
 * Asterisk lab readiness probes and AMI helpers (D-05–D-07).
 * Black-box only — no Nest imports.
 */
import { connect as netConnect } from 'node:net';

export function hasAsteriskLabFlag(): boolean {
  return process.env.HAS_ASTERISK === '1';
}

function amiConfig(): { host: string; port: number } {
  return {
    host: process.env.AMI_HOST ?? '127.0.0.1',
    port: Number(process.env.AMI_PORT ?? 5038),
  };
}

function ariConfig(): { baseUrl: string; user: string; password: string } {
  const protocol = process.env.ARI_PROTOCOL ?? 'http';
  const host = process.env.ARI_HOST ?? 'localhost';
  const port = process.env.ARI_PORT ?? '8088';
  const baseUrl = `${protocol}://${host}:${port}/ari`;
  return {
    baseUrl,
    user: process.env.ARI_USER ?? 'krasterisk',
    password: process.env.ARI_PASSWORD ?? '',
  };
}

/** TCP connect probe to AMI_HOST:AMI_PORT (RESEARCH Pattern 6). */
export async function amiTcpReady(host?: string, port?: number): Promise<boolean> {
  const cfg = amiConfig();
  const targetHost = host ?? cfg.host;
  const targetPort = port ?? cfg.port;

  return new Promise((resolve) => {
    const socket = netConnect({ host: targetHost, port: targetPort, timeout: 5_000 });
    const finish = (ok: boolean) => {
      socket.removeAllListeners();
      socket.destroy();
      resolve(ok);
    };
    socket.once('connect', () => finish(true));
    socket.once('timeout', () => finish(false));
    socket.once('error', () => finish(false));
  });
}

/** GET {ARI_BASE}/asterisk/info with basic auth (RESEARCH Pattern 6). */
export async function ariInfoReady(base?: string, user?: string, pass?: string): Promise<boolean> {
  const cfg = ariConfig();
  const baseUrl = (base ?? cfg.baseUrl).replace(/\/$/, '');
  const authUser = user ?? cfg.user;
  const authPass = pass ?? cfg.password;
  const auth = Buffer.from(`${authUser}:${authPass}`).toString('base64');

  try {
    const res = await fetch(`${baseUrl}/asterisk/info`, {
      headers: { Authorization: `Basic ${auth}` },
      signal: AbortSignal.timeout(5_000),
    });
    return res.ok;
  } catch {
    return false;
  }
}

/** Combined lab readiness: AMI TCP + ARI /asterisk/info (D-07). */
export async function isAsteriskLabReady(): Promise<boolean> {
  if (!hasAsteriskLabFlag()) return false;
  const [ami, ari] = await Promise.all([amiTcpReady(), ariInfoReady()]);
  return ami && ari;
}

/** Vitest helper — returns true when suite should skip (HAS_ASTERISK !== '1', D-06). */
export function skipIfNoAsterisk(): boolean {
  return !hasAsteriskLabFlag();
}

export interface OriginateInboundOptions {
  /** ASSUMED A5 — override via HARNESS_ORIGINATE_EXTEN */
  exten?: string;
  /** ASSUMED A5 — dialplan context for inbound originate */
  context?: string;
  /** Channel to originate from, e.g. Local/s@from-internal */
  channel?: string;
  callerId?: string;
}

/**
 * Lab AMI helper: Originate inbound call toward agent extension (D-05 tier 2).
 * Uses asterisk-manager — gated scenarios only.
 */
export async function originateInboundToAgent(options: OriginateInboundOptions = {}): Promise<void> {
  // Dynamic import keeps asterisk-manager out of default harness load path
  const AmiClient = (await import('asterisk-manager')).default;
  const { host, port } = amiConfig();
  const login = process.env.AMI_LOGIN ?? 'krasterisk';
  const secret = process.env.AMI_SECRET ?? '';

  const exten = options.exten ?? process.env.HARNESS_ORIGINATE_EXTEN ?? '100';
  const context = options.context ?? process.env.HARNESS_ORIGINATE_CONTEXT ?? 'from-internal';
  const channel = options.channel ?? `Local/${exten}@${context}`;
  const callerId = options.callerId ?? 'Harness Test <9999>';

  const ami = new AmiClient(port, host, login, secret, true);
  await new Promise<void>((resolve, reject) => {
    ami.on('connect', () => resolve());
    ami.on('error', reject);
  });

  try {
    await new Promise<void>((resolve, reject) => {
      ami.action(
        {
          action: 'Originate',
          channel,
          callerid: callerId,
          context,
          exten,
          priority: '1',
          async: 'true',
        },
        (err: Error | null) => {
          if (err) reject(err);
          else resolve();
        },
      );
    });
  } finally {
    ami.disconnect();
  }
}
