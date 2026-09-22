import { UserLevel } from '../users/user.model';
import { IntegrationCredentialsService } from './integration-credentials.service';

const now = new Date('2026-09-19T00:00:00.000Z');
const context = Object.freeze({
  tenantUid: 0, principalId: 'user:7', principalKind: 'user' as const,
  permissionRevision: '1', requestId: '00000000-0000-4000-8000-000000000007',
});
const op1 = '00000000-0000-4000-8000-000000000001';
const op2 = '00000000-0000-4000-8000-000000000002';
const PROJECT = '00000000-0000-4000-8000-0000000000aa';
const parts = (token: string): [string, string] => {
  const body = token.slice('krint_v1_'.length);
  return [body.slice(0, 22), body.slice(23)];
};

function fixture() {
  const principalRows = new Map<string, any>();
  const credentialRows: any[] = [];
  const grantRows: any[] = [];
  const commandRows = new Map<string, any>();
  const auditRows: any[] = [];
  const tenants = { findOne: jest.fn().mockResolvedValue({ status: 'active' }) };
  const users = { findOne: jest.fn().mockResolvedValue({
    uniqueid: 7, isActivated: true, level: UserLevel.ADMIN,
  }) };
  const principals = {
    create: jest.fn(async (value) => {
      const row = { ...value, update: jest.fn(async (patch) => Object.assign(row, patch)) };
      principalRows.set(row.id, row);
      return row;
    }),
    findOne: jest.fn(async ({ where }) => {
      const row = principalRows.get(where.id);
      return row?.tenant_uid === where.tenant_uid ? row : null;
    }),
    findAll: jest.fn(async ({ where } = {}) => [...principalRows.values()].filter((row) => {
      if (where?.tenant_uid != null && row.tenant_uid !== where.tenant_uid) return false;
      if (where?.product != null && row.product !== where.product) return false;
      if (where?.status != null && row.status !== where.status) return false;
      return true;
    })),
  };
  const credentials = {
    create: jest.fn(async (value) => {
      const row = { ...value, update: jest.fn(async (patch) => Object.assign(row, patch)) };
      credentialRows.push(row);
      return row;
    }),
    findOne: jest.fn(async ({ where }) => {
      if (where.selector) return credentialRows.find((row) => row.selector === where.selector) ?? null;
      return credentialRows.filter((row) => row.tenant_uid === where.tenant_uid
        && row.principal_id === where.principal_id)
        .sort((a, b) => b.generation - a.generation)[0] ?? null;
    }),
  };
  const grants = {
    destroy: jest.fn(async ({ where }) => {
      for (let i = grantRows.length - 1; i >= 0; i -= 1) {
        const row = grantRows[i];
        if (where?.tenant_uid != null && row.tenant_uid !== where.tenant_uid) continue;
        if (where?.principal_id != null && row.principal_id !== where.principal_id) continue;
        grantRows.splice(i, 1);
      }
      return 0;
    }),
    bulkCreate: jest.fn(async (rows) => {
      grantRows.push(...rows);
      return rows;
    }),
    findAll: jest.fn(async ({ where } = {}) => grantRows.filter((row) => {
      if (where?.tenant_uid != null && row.tenant_uid !== where.tenant_uid) return false;
      if (where?.principal_id != null && row.principal_id !== where.principal_id) return false;
      if (where?.resource_kind != null && row.resource_kind !== where.resource_kind) return false;
      if (where?.scope != null && row.scope !== where.scope) return false;
      return true;
    })),
  };
  const audits = { create: jest.fn(async (value) => { auditRows.push(value); return value; }) };
  const commands = {
    create: jest.fn(async (value) => {
      commandRows.set(`${value.tenant_uid}:${value.actor_user_id}:${value.operation_id}`, value);
      return value;
    }),
    findOne: jest.fn(async ({ where }) => commandRows.get(
      `${where.tenant_uid}:${where.actor_user_id}:${where.operation_id}`) ?? null),
  };
  const sequelize = { transaction: jest.fn(async (callback) => callback({ LOCK: { UPDATE: 'UPDATE' } })) };
  const products = { decide: jest.fn().mockResolvedValue({ allowed: true }) };
  const resources = { authorize: jest.fn().mockRejectedValue(new Error('resolver missing')) };
  const service = new IntegrationCredentialsService(
    tenants as any, users as any, principals as any, credentials as any, grants as any,
    audits as any, commands as any, sequelize as any, products as any, resources as any,
  );
  return { service, principalRows, credentialRows, grantRows, commandRows, auditRows,
    tenants, users, principals, credentials, grants, audits, commands, products, resources };
}

describe('IntegrationCredentialsService', () => {
  it('creates a no-grants principal and returns secret once; replay returns metadata only', async () => {
    const f = fixture();
    const input = { label: 'External PBX', product: 'speech_analytics' as const, operationId: op1 };
    const first = await f.service.create(context, input, now);
    expect(first).toMatchObject({ generation: 1, replay: false });
    expect(first.token).toMatch(/^krint_v1_[A-Za-z0-9_-]{22}_[A-Za-z0-9_-]{43}$/);
    expect(f.credentialRows[0].secret_digest).toHaveLength(32);
    expect(f.credentialRows[0]).not.toHaveProperty('secret');
    expect(f.grants.bulkCreate).not.toHaveBeenCalled();
    const replay = await f.service.create(context, input, now);
    expect(replay).toEqual({ principalId: first.principalId, generation: 1, token: null, replay: true });
    expect(f.principals.create).toHaveBeenCalledTimes(1);
    expect(JSON.stringify(f.auditRows)).not.toContain(first.token);
    await expect(f.service.create(context, { ...input, label: 'Changed' }, now))
      .rejects.toMatchObject({ response: expect.objectContaining({ code: 'operation_conflict' }) });
  });

  it('rotates exactly once, rejects stale generation, and disables all generations', async () => {
    const f = fixture();
    const first = await f.service.create(context, {
      label: 'External PBX', product: 'speech_analytics', operationId: op1,
    }, now);
    const [firstSelector, firstSecret] = parts(first.token!);
    await expect(f.service.authenticate(firstSelector, firstSecret, 'r', now))
      .resolves.toMatchObject({ tenantUid: 0, principalId: first.principalId, principalKind: 'integration' });
    const rotated = await f.service.rotate(context, first.principalId, 1, op2, now);
    expect(rotated).toMatchObject({ generation: 2, replay: false });
    expect(rotated.token).not.toBe(first.token);
    expect(f.credentialRows[0].revoked_at).toEqual(now);
    await expect(f.service.authenticate(firstSelector, firstSecret, 'r', now)).rejects.toThrow();
    const [nextSelector, nextSecret] = parts(rotated.token!);
    await expect(f.service.authenticate(nextSelector, nextSecret, 'r', now)).resolves.toBeDefined();
    expect(await f.service.rotate(context, first.principalId, 1, op2, now))
      .toEqual({ principalId: first.principalId, generation: 2, token: null, replay: true });
    await expect(f.service.rotate(context, first.principalId, 1,
      '00000000-0000-4000-8000-000000000003', now)).rejects.toMatchObject({
      response: expect.objectContaining({ code: 'credential_generation_stale' }),
    });
    expect(await f.service.disable(context, first.principalId, now)).toBe(true);
    expect(await f.service.disable(context, first.principalId, now)).toBe(false);
    await expect(f.service.authenticate(nextSelector, nextSecret, 'r', now)).rejects.toThrow();
  });

  it('rejects unowned grants and permits only an empty set before resolvers exist', async () => {
    const f = fixture();
    const first = await f.service.create(context, {
      label: 'External PBX', product: 'speech_analytics', operationId: op1,
    }, now);
    await expect(f.service.replaceGrants(context, first.principalId, '1', [{
      resourceKind: 'project', resourceId: '00000000-0000-4000-8000-000000000004', scope: 'analytics:read',
    }], now)).rejects.toThrow('resolver missing');
    expect(f.grants.destroy).not.toHaveBeenCalled();
    await expect(f.service.replaceGrants(context, first.principalId, '1', [{
      resourceKind: 'deployment', resourceId: '00000000-0000-4000-8000-000000000004', scope: 'robots:invoke',
    }], now)).rejects.toMatchObject({ response: expect.objectContaining({ code: 'integration_scope_invalid' }) });
    expect(await f.service.replaceGrants(context, first.principalId, '1', [], now)).toBe('2');
    expect(f.grants.destroy).toHaveBeenCalledWith(expect.objectContaining({
      where: { tenant_uid: 0, principal_id: first.principalId },
    }));
  });

  it('fails closed on unknown key, expired product access and cross-tenant credential', async () => {
    const f = fixture();
    await expect(f.service.authenticate('A'.repeat(22), 'b'.repeat(43), 'r', now)).rejects.toThrow();
    const first = await f.service.create(context, {
      label: 'External PBX', product: 'speech_analytics', operationId: op1,
    }, now);
    const [selector, secret] = parts(first.token!);
    f.products.decide.mockResolvedValueOnce({ allowed: false, reason: 'product_disabled' });
    await expect(f.service.authenticate(selector, secret, 'r', now)).rejects.toMatchObject({
      response: expect.objectContaining({ code: 'product_disabled' }),
    });
    expect(f.principals.findOne).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: first.principalId, tenant_uid: 0 },
    }));
  });

  it('refuses management writes when the current user is no longer tenant admin', async () => {
    const f = fixture();
    f.users.findOne.mockResolvedValue(null);
    await expect(f.service.create(context, {
      label: 'External PBX', product: 'speech_analytics', operationId: op1,
    }, now)).rejects.toMatchObject({
      response: expect.objectContaining({ code: 'integration_admin_required' }),
    });
    expect(f.principals.create).not.toHaveBeenCalled();
  });

  describe('speech-analytics project tokens (D-32, D-33)', () => {
    it('returns plaintext once, stores only secret_digest, and binds one project', async () => {
      const f = fixture();
      f.resources.authorize.mockResolvedValue(undefined);
      const issued = await f.service.issueSpeechAnalyticsToken(context, {
        label: 'CRM bridge', projectId: PROJECT, operationId: op1,
      }, now);
      expect(issued.token).toMatch(/^krint_v1_[A-Za-z0-9_-]{22}_[A-Za-z0-9_-]{43}$/);
      expect(issued.projectId).toBe(PROJECT);
      expect(issued.replay).toBe(false);
      expect(f.credentialRows[0].secret_digest).toHaveLength(32);
      expect(f.credentialRows[0]).not.toHaveProperty('secret');
      expect(JSON.stringify(f.credentialRows[0])).not.toContain(issued.token!);
      expect(f.grants.bulkCreate).toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.objectContaining({
            resource_kind: 'project', resource_id: PROJECT, scope: 'analytics:upload',
          }),
          expect.objectContaining({
            resource_kind: 'project', resource_id: PROJECT, scope: 'analytics:read',
          }),
        ]),
        expect.anything(),
      );
      const replay = await f.service.issueSpeechAnalyticsToken(context, {
        label: 'CRM bridge', projectId: PROJECT, operationId: op1,
      }, now);
      expect(replay.token).toBeNull();
      expect(replay.replay).toBe(true);
    });

    it('lists name, project, lastUsed without secret; SUPERVISOR cannot issue', async () => {
      const f = fixture();
      f.resources.authorize.mockResolvedValue(undefined);
      const issued = await f.service.issueSpeechAnalyticsToken(context, {
        label: 'CRM bridge', projectId: PROJECT, operationId: op1,
      }, now);
      const page = await f.service.listSpeechAnalyticsTokens(context);
      expect(page).toEqual([expect.objectContaining({
        name: 'CRM bridge', projectId: PROJECT, principalId: issued.principalId,
      })]);
      expect(page[0]).toHaveProperty('lastUsed');
      expect(JSON.stringify(page)).not.toContain(issued.token!);
      expect(JSON.stringify(page)).not.toContain('secret_digest');
      expect(JSON.stringify(page)).not.toMatch(/krint_v1_/);

      f.users.findOne.mockResolvedValue({
        uniqueid: 7, isActivated: true, level: UserLevel.SUPERVISOR,
      });
      await expect(f.service.issueSpeechAnalyticsToken(context, {
        label: 'Nope', projectId: PROJECT, operationId: op2,
      }, now)).rejects.toMatchObject({
        response: expect.objectContaining({ code: 'integration_admin_required' }),
      });
    });

    it('allows SUPERADMIN issuer and leaves tokens when module is off', async () => {
      const f = fixture();
      f.resources.authorize.mockResolvedValue(undefined);
      f.users.findOne.mockResolvedValue({
        uniqueid: 7, isActivated: true, level: UserLevel.SUPERADMIN,
      });
      const issued = await f.service.issueSpeechAnalyticsToken(context, {
        label: 'Platform issued', projectId: PROJECT, operationId: op1,
      }, now);
      expect(issued.token).toMatch(/^krint_v1_/);
      // Module-off blocks auth at ProductAccess decide — tokens remain in store.
      f.products.decide.mockResolvedValue({ allowed: false, reason: 'product_disabled' });
      const [selector, secret] = parts(issued.token!);
      await expect(f.service.authenticate(selector, secret, 'r', now)).rejects.toMatchObject({
        response: expect.objectContaining({ code: 'product_disabled' }),
      });
      expect(f.principalRows.size).toBe(1);
      expect([...f.principalRows.values()][0].status).toBe('active');
    });
  });

  it('lists sanitized tenant metadata and exposes only own empty capability state', async () => {
    const f = fixture();
    const first = await f.service.create(context, {
      label: 'External PBX', product: 'speech_analytics', operationId: op1,
    }, now);
    const page = await f.service.list(context, 50);
    expect(page.items).toEqual([expect.objectContaining({
      id: first.principalId, label: 'External PBX', generation: 1,
    })]);
    expect(JSON.stringify(page)).not.toContain(first.token!);
    expect(JSON.stringify(page)).not.toContain('secret_digest');
    const [selector, secret] = parts(first.token!);
    const machine = await f.service.authenticate(selector, secret, 'request', now);
    expect(await f.service.selfCapabilities(machine)).toEqual({
      principalId: first.principalId, product: 'speech_analytics',
      permissionRevision: '1', state: 'not_configured',
      action: 'create_project', grants: [],
    });
    f.grants.findAll.mockResolvedValueOnce([{
      resource_kind: 'project', resource_id: '00000000-0000-4000-8000-000000000009',
      scope: 'analytics:read',
    }]);
    expect(await f.service.selfCapabilities(machine)).toMatchObject({
      state: 'temporarily_unavailable', action: 'retry_later', grants: [],
    });
    f.grants.findAll.mockResolvedValueOnce([{
      resource_kind: 'project', resource_id: '00000000-0000-4000-8000-000000000009',
      scope: 'analytics:read',
    }]);
    f.resources.authorize.mockResolvedValueOnce(undefined);
    expect(await f.service.selfCapabilities(machine)).toMatchObject({
      state: 'available', action: null,
      grants: [{ resourceKind: 'project', resourceId: '00000000-0000-4000-8000-000000000009',
        scope: 'analytics:read' }],
    });
    await expect(f.service.selfCapabilities(context)).rejects.toMatchObject({ status: 403 });
    await expect(f.service.list(machine, 50)).rejects.toMatchObject({ status: 403 });
  });
});
