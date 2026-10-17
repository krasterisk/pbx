import { ForbiddenException, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHash, createHmac, timingSafeEqual } from 'node:crypto';
import type { Request, Response } from 'express';
import type { AuthTokenResponse } from './dto/auth-response.dto';
import { requireJwtSecret } from './jwt-secret';

const cookieName = 'krsk_interactive';
const digest = (value: string) => createHash('sha256').update(value).digest('hex');
interface Proof { sub: number; tenant: number; access: string; refresh: string; expires: number }

/** A bearer token alone cannot mint this proof: it is issued only after password login. */
@Injectable()
export class InteractiveSessionService {
  constructor(private readonly config: ConfigService) {}
  private signature(body: string): Buffer {
    return createHmac('sha256', requireJwtSecret(this.config)).update('interactive-session-v1\0').update(body).digest();
  }
  private read(req: Pick<Request, 'headers'>): Proof | null {
    const raw = req.headers.cookie?.split(';').map((part) => part.trim()).find((part) => part.startsWith(`${cookieName}=`))?.slice(cookieName.length + 1);
    if (!raw || raw.length > 2048) return null;
    const [body, signature, extra] = raw.split('.');
    if (!body || !signature || extra) return null;
    const actual = Buffer.from(signature, 'base64url'), expected = this.signature(body);
    if (actual.length !== expected.length || !timingSafeEqual(actual, expected)) return null;
    try { const proof = JSON.parse(Buffer.from(body, 'base64url').toString('utf8')) as Proof;
      return proof.expires > Date.now() && Number.isSafeInteger(proof.sub) && proof.sub > 0
        && Number.isSafeInteger(proof.tenant) && proof.tenant >= 0 ? proof : null;
    } catch { return null; }
  }
  issue(res: Response, result: AuthTokenResponse, req: Pick<Request, 'secure'>): void {
    const body = Buffer.from(JSON.stringify({ sub: result.user.uniqueid, tenant: result.user.vpbx_user_uid,
      access: digest(result.accessToken), refresh: digest(result.refreshToken), expires: Date.now() + 30 * 86400000 } satisfies Proof)).toString('base64url');
    res.cookie(cookieName, `${body}.${this.signature(body).toString('base64url')}`, { httpOnly: true, sameSite: 'strict',
      secure: req.secure || this.config.get('NODE_ENV') === 'production', path: '/api', maxAge: 30 * 86400000 });
  }
  rotate(req: Request, res: Response, oldRefresh: string, result: AuthTokenResponse): void {
    const proof = this.read(req);
    if (proof && proof.refresh === digest(oldRefresh) && proof.sub === result.user.uniqueid && proof.tenant === result.user.vpbx_user_uid)
      this.issue(res, result, req);
  }
  clear(res: Response): void { res.clearCookie(cookieName, { httpOnly: true, sameSite: 'strict', path: '/api' }); }
  assert(req: Request & { user?: { sub?: number; vpbx_user_uid?: number; integration_key_uid?: number } }): void {
    const proof = this.read(req), auth = req.headers.authorization;
    const token = typeof auth === 'string' && auth.startsWith('Bearer ') ? auth.slice(7) : '';
    if (req.user?.integration_key_uid || !proof || !token || proof.access !== digest(token)
      || proof.sub !== req.user?.sub || proof.tenant !== req.user?.vpbx_user_uid)
      throw new ForbiddenException({ code: 'AC_INTERACTIVE_SESSION_REQUIRED', message: 'Sign in with your password in the browser to confirm this change.' });
    // SameSite cookie protects browser requests; reject explicitly cross-site fetches too.
    if (req.headers['sec-fetch-site'] === 'cross-site') throw new ForbiddenException({ code: 'AC_INTERACTIVE_SESSION_REQUIRED' });
  }
}
