import { APP_VERSION } from '@krasterisk/shared';
import { HealthController } from './health.controller';
import { resolveGitSha, withAppIdentity } from './app-identity';
import {
  currentSchemaVersion, rememberSchemaVersion, resetSchemaVersionForTests,
} from '../../database/schema-stamp';

describe('application identity', () => {
  afterEach(() => {
    resetSchemaVersionForTests();
  });

  it('prefers the build SHA injected into the image', () => {
    expect(resolveGitSha({ APP_GIT_SHA: 'abc123def456' })).toBe('abc123def456');
    expect(resolveGitSha({ APP_GIT_SHA: '   ' })).toMatch(/^[0-9a-f]{7,}$|^unknown$/);
  });

  it('reports the application version without a database read', () => {
    const body = new HealthController().check();
    expect(body.status).toBe('ok');
    expect(body.version).toBe(APP_VERSION);
    expect(body.version).toMatch(/^4\.\d+\.\d+\.\d+$/);
    expect(body.sha.length).toBeGreaterThan(0);
    expect(body.schema).toBeNull();
    expect(body.timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T/);
  });

  it('attaches the schema recorded during startup readiness', () => {
    rememberSchemaVersion('0035');
    expect(currentSchemaVersion()).toBe('0035');
    expect(withAppIdentity({ status: 'ok', profile: 'analytics-api' })).toMatchObject({
      status: 'ok',
      profile: 'analytics-api',
      version: APP_VERSION,
      schema: '0035',
    });
    rememberSchemaVersion('');
    expect(currentSchemaVersion()).toBe('0035');
  });
});
