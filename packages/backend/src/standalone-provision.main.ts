import { readFileSync } from 'node:fs';
import * as bcrypt from 'bcrypt';
import { NestFactory } from '@nestjs/core';
import { StandaloneAiCoreModule, type StandaloneAiProfile } from './compositions/standalone-ai-core.module';
import { TenantIdentityService } from './modules/tenant-identity/tenant-identity.service';

/** Installer-only command. Reads the password from a pipe, never argv or environment. */
async function main(): Promise<void> {
  const profile = process.env.DB_SCHEMA_PROFILE;
  if (profile !== 'analytics-api' && profile !== 'robot-api') {
    throw new Error('DB_SCHEMA_PROFILE must be analytics-api or robot-api');
  }
  const login = process.env.STANDALONE_ADMIN_LOGIN?.trim() ?? '';
  const name = process.env.STANDALONE_ADMIN_NAME?.trim() ?? '';
  const companyName = process.env.STANDALONE_COMPANY_NAME?.trim() ?? '';
  if (!login || !name || !companyName || process.stdin.isTTY) {
    throw new Error('Set admin login/name/company and pipe the password to stdin');
  }
  const password = readFileSync(0, 'utf8').replace(/\r?\n$/, '');
  if (password.length < 12 || password.length > 128 || /[\r\n\0]/.test(password)) {
    throw new Error('Admin password must be 12–128 characters');
  }
  const passwordHash = await bcrypt.hash(password, 12);
  const app = await NestFactory.createApplicationContext(
    StandaloneAiCoreModule.forProfile(profile as StandaloneAiProfile), { logger: false },
  );
  try {
    const identities = app.get(TenantIdentityService);
    const result = await identities.create({
      login, name, companyName, passwordHash, activateImmediately: true,
    }, 'standalone-ai');
    process.stdout.write(`Provisioned tenant ${result.tenant.vpbx_user_uid}\n`);
  } finally {
    await app.close();
  }
}

void main().catch((error: unknown) => {
  process.stderr.write(`${error instanceof Error ? error.message : 'Provisioning failed'}\n`);
  process.exitCode = 1;
});
