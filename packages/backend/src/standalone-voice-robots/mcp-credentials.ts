import { BadRequestException, Body, CanActivate, Controller, Delete, ExecutionContext, Get, Injectable, Param, Post, Req, UnauthorizedException, UseGuards } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHash, randomBytes, randomUUID } from 'node:crypto';
import { existsSync, readFileSync, renameSync, writeFileSync } from 'node:fs';
import { z } from 'zod';
import { robotTenant, StandaloneRobotGuard, type StandaloneRobotRequest } from './access';

type Credential = { id: string; name: string; tenant: number; hash: string; scope: 'read' | 'configure'; createdAt: string; expiresAt: string };
const issueSchema = z.strictObject({ name: z.string().trim().min(1).max(80), scope: z.enum(['read', 'configure']), days: z.number().int().min(1).max(30).default(7) });
export interface McpRequest extends StandaloneRobotRequest { mcpCredential?: Pick<Credential, 'id' | 'scope' | 'tenant'>; }
/** Single Node process, synchronous atomic file replacement: no cross-request lost updates. No plaintext token persists. */
@Injectable()
export class RobotMcpCredentials {
  constructor(private readonly config: ConfigService) {}
  private file() { return this.config.get<string>('VOICE_ROBOTS_MCP_CREDENTIALS_FILE') || '/var/lib/krasterisk-voice-robots/mcp-credentials.json'; }
  private rows(): Credential[] { return existsSync(this.file()) ? JSON.parse(readFileSync(this.file(), 'utf8')) : []; }
  private save(rows: Credential[]) {
    const temporary = this.file() + '.' + randomUUID() + '.tmp';
    writeFileSync(temporary, JSON.stringify(rows), { encoding: 'utf8', mode: 0o600, flag: 'wx' });
    renameSync(temporary, this.file());
  }
  list(tenant: number) { return this.rows().filter(r => r.tenant === tenant).map(({ hash: _hash, tenant: _tenant, ...row }) => row); }
  issue(tenant: number, raw: unknown) {
    const args = issueSchema.parse(raw); const rows = this.rows().filter(r => Date.parse(r.expiresAt) > Date.now());
    if (rows.filter(r => r.tenant === tenant).length >= 20 || rows.length >= 200) throw new BadRequestException('Credential limit reached');
    const token = 'krvr_' + randomBytes(32).toString('base64url');
    const row: Credential = { id: randomUUID(), name: args.name, tenant, scope: args.scope,
      hash: createHash('sha256').update(token).digest('hex'), createdAt: new Date().toISOString(), expiresAt: new Date(Date.now() + args.days * 86400000).toISOString() };
    this.save([...rows, row]);
    const { hash: _hash, tenant: _tenant, ...visible } = row;
    return { ...visible, token, message: 'Shown once; keep in MCP client secret storage. Never put in AGENTS.md or scenario JSON.' };
  }
  revoke(tenant: number, id: string) { const rows = this.rows(); const next = rows.filter(r => !(r.tenant === tenant && r.id === id));
    if (next.length === rows.length) throw new BadRequestException('Credential not found'); this.save(next); return { revoked: true }; }
  authenticate(value: unknown): Pick<Credential, 'id' | 'scope' | 'tenant'> {
    if (typeof value !== 'string' || !/^Bearer krvr_[A-Za-z0-9_-]{43}$/.test(value)) throw new UnauthorizedException('MCP bearer credential required');
    const hash = createHash('sha256').update(value.slice(7)).digest('hex');
    const row = this.rows().find(r => r.hash === hash && Date.parse(r.expiresAt) > Date.now());
    if (!row) throw new UnauthorizedException('Invalid or expired MCP credential');
    return { id: row.id, scope: row.scope, tenant: row.tenant };
  }
}
@Injectable()
export class RobotMcpGuard implements CanActivate {
  constructor(private readonly credentials: RobotMcpCredentials) {}
  canActivate(context: ExecutionContext) { const request = context.switchToHttp().getRequest<McpRequest>();
    request.mcpCredential = this.credentials.authenticate(request.headers.authorization);
    request.robotTenantUid = request.mcpCredential.tenant; return true; }
}
@Controller('public/voice-robots-mcp/credentials')
@UseGuards(StandaloneRobotGuard)
export class RobotMcpCredentialsController {
  constructor(private readonly credentials: RobotMcpCredentials) {}
  @Get() list(@Req() req: StandaloneRobotRequest) { return { credentials: this.credentials.list(robotTenant(req)) }; }
  @Post() issue(@Req() req: StandaloneRobotRequest, @Body() body: unknown) { return this.credentials.issue(robotTenant(req), body); }
  @Delete(':id') revoke(@Req() req: StandaloneRobotRequest, @Param('id') id: string) { return this.credentials.revoke(robotTenant(req), z.string().uuid().parse(id)); }
}
