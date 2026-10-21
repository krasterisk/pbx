import { randomBytes } from 'node:crypto';
import { resolve } from 'node:path';
import { config } from 'dotenv';
import { createConnection, type Connection } from 'mysql2/promise';
import { Sequelize } from 'sequelize-typescript';
import { AUTODIAL_SCHEMA_STATEMENTS } from './setup-autodial-schema';
import { AutodialBasesService } from './autodial-bases.service';
import { AutodialImportService } from './autodial-import.service';
import { AutodialAttemptService } from './autodial-attempt.service';
import { AcBase } from './models/ac-base.model';
import { AcBaseField } from './models/ac-base-field.model';
import { AcContact } from './models/ac-contact.model';
import { AcContactPhone } from './models/ac-contact-phone.model';
import { AcCampaign } from './models/ac-campaign.model';
import { AcTask } from './models/ac-task.model';
import { AcAttempt } from './models/ac-attempt.model';
import { AcImportProfile } from './models/ac-import-profile.model';
import { AcImportRun } from './models/ac-import-run.model';
import { AcDnc } from './models/ac-dnc.model';
import { AutodialDncService } from './autodial-dnc.service';
import { AutodialCampaignsService } from './autodial-campaigns.service';
import { AcSchedule } from './models/ac-schedule.model';
import { AutodialDiagnosisService } from './autodial-diagnosis.service';
import { AutodialStateService } from './autodial-state.service';
import { AutodialTestCallService } from './autodial-test-call.service';
import { AutodialSchemaService } from './autodial-schema.service';
import { AutodialAnalyticsService } from './autodial-analytics.service';
import { AutodialReportsService } from './autodial-reports.service';
import { AcDailyCampaignStats } from './models/ac-daily-campaign-stats.model';
import { AutodialReportSelectionService } from './autodial-report-selection.service';
import { AutodialCrmService } from './autodial-crm.service';
import { AutodialIntegrationKeyService } from '../autodial-integration/autodial-integration-key.service';
import { AutodialWebhooksService } from './autodial-webhooks.service';

// Opt-in only. Existing databases/tables are never written, truncated or dropped.
const databaseTests = process.env.AUTODIAL_DB_INTEGRATION === '1' ? describe : describe.skip;
jest.setTimeout(30000);
databaseTests('Autodial data transactions (isolated MySQL schema)', () => {
  const schema = 'krsk_ac_test_' + randomBytes(8).toString('hex');
  let admin: Connection | undefined;
  let db: Sequelize | undefined;
  let created = false;
  let bases: AutodialBasesService;
  let importer: AutodialImportService;
  let sequence = 0;
  beforeAll(async () => {
    config({ path: resolve(__dirname, '../../../../../.env'), quiet: true });
    if (!process.env.DB_HOST || !process.env.DB_USER) throw new Error('Explicit DB_HOST/DB_USER required');
    const credentials = {
      host: process.env.DB_HOST, port: Number(process.env.DB_PORT || 3306),
      user: process.env.DB_USER, password: process.env.DB_PASSWORD || '',
    };
    if (!/^krsk_ac_test_[a-f0-9]{16}$/.test(schema) || schema === process.env.DB_NAME) throw new Error('Unsafe test schema');
    admin = await createConnection({ ...credentials, connectTimeout: 5000 });
    // No IF NOT EXISTS: only a schema created successfully by this run may be removed.
    await admin.query('CREATE DATABASE ' + schema + ' CHARACTER SET utf8mb4');
    created = true;
    db = new Sequelize({
      dialect: 'mysql', host: credentials.host, port: credentials.port,
      username: credentials.user, password: credentials.password, database: schema,
      logging: false,
      models: [AcBase, AcBaseField, AcContact, AcContactPhone, AcCampaign, AcTask, AcAttempt, AcImportProfile, AcImportRun, AcDnc, AcSchedule, AcDailyCampaignStats],
    });
    for (const statement of AUTODIAL_SCHEMA_STATEMENTS) await db.query(statement);
    await db.query('CREATE TABLE users (uniqueid INT PRIMARY KEY, vpbx_user_uid INT, exten VARCHAR(32))');
    await db.query('CREATE TABLE ps_endpoints (id VARCHAR(128) PRIMARY KEY, tenantid VARCHAR(40))');
    bases = new AutodialBasesService(AcBase, AcBaseField, AcContact, AcContactPhone, db, AcTask, AcCampaign, AcImportProfile);
    importer = new AutodialImportService(AcBase, AcBaseField, AcContact, AcContactPhone, AcImportProfile, AcImportRun, bases, db);
  }, 60000);
  afterAll(async () => {
    await db?.close();
    if (created && admin && /^krsk_ac_test_[a-f0-9]{16}$/.test(schema) && schema !== process.env.DB_NAME) {
      await admin.query('DROP DATABASE ' + schema);
      console.info('Removed isolated autodial test schema:', schema);
    }
    await admin?.end();
  }, 30000);

  const createBase = (userUid = 71) => bases.create(userUid, {
    name: 'autodial-r1-' + (++sequence),
    fields: [
      { key: 'name', label: 'Name', type: 'string', required: true },
      { key: 'phone', label: 'Phone', type: 'phone', required: true },
    ],
  });
  const createContact = (baseUid: number, raw = '79001234567') => bases.createContact(71, baseUid, {
    values: { name: 'Alice' }, phones: [{ raw }], comment: 'before', external_id: 'old',
  });
  const upload = (buffer: string) => ({
    source: 'csv' as const, filename: 'test.csv', buffer: Buffer.from(buffer), delimiter: ';',
    column_map: [{ column: 'name', field_key: 'name' }, { column: 'phone', field_key: '__phone' }],
  });

  const campaignService = () => new AutodialCampaignsService(
    AcCampaign, AcSchedule, AcTask, AcAttempt, AcContactPhone, AcDnc,
    { findAll: async () => [{ id: 'isolated-trunk' }] } as never,
    { findAll: async () => [] } as never, db!, bases, {} as never,
    { applyCampaign: async () => true, assertAmdReady: async () => undefined } as never,
  );

  it('joins campaign contacts, applies phone/outcome filters and isolates tenants', async () => {
    const base = await createBase();
    const contact = await createContact(base.uid, '79009991122');
    const other = await bases.createContact(71, base.uid, { values: { name: 'Other' }, phones: [{ raw: '79009992233' }] });
    const campaign = await AcCampaign.create({ user_uid: 71, base_uid: base.uid, name: 'Workspace fixture', pacing: {}, retry: {}, trunk_pool: [], cid_policy: {}, queue_names: [], scenario_actions: [], amd: {} });
    await AcTask.create({ user_uid: 71, campaign_uid: campaign.uid, contact_uid: contact.uid, phone_uid: contact.phones[0].uid, attempt_count: 2, last_disposition: 'busy', next_attempt_at: new Date(Date.now() + 60000) });
    await new AutodialDncService(AcDnc, AcBase, AcCampaign).create(71, { scope: 'campaign', scope_uid: campaign.uid, normalized_phone: contact.phones[0].normalized });
    const campaigns = campaignService();
    const result = await campaigns.listContacts(71, campaign.uid, { q: '9991122', disposition: 'busy' });
    expect(result.total).toBe(1);
    expect(result.items[0]).toMatchObject({ uid: contact.uid, blocked_phone_uids: [contact.phones[0].uid], tasks: [{ attempt_count: 2, last_disposition: 'busy', dnc: true }] });
    expect((await campaigns.listContacts(71, campaign.uid, { disposition: 'success' })).items).toEqual([]);
    expect((await campaigns.listContacts(71, campaign.uid, { page: 1, pageSize: 1 })).items[0].uid).toBe(other.uid);
    const diagnosis = await new AutodialDiagnosisService(campaigns, new AutodialStateService(),
      { getAllAgents: () => [] } as never, { isConnected: () => true } as never, db!).diagnose(71, campaign.uid);
    expect(diagnosis).toMatchObject({ ready_tasks: 0, waiting_tasks: 1 });
    const rescheduled = await campaigns.changeContactTask(71, campaign.uid, contact.uid, { action: 'reschedule', next_attempt_at: new Date(Date.now() + 120000).toISOString() });
    expect(rescheduled).toEqual({ updated: 1 });
    await expect(campaigns.changeContactTask(72, campaign.uid, contact.uid, { action: 'exclude' })).rejects.toMatchObject({ status: 404 });
    const activeTask = (await AcTask.findOne({ where: { campaign_uid: campaign.uid } }))!;
    await activeTask.update({ status: 'dialing' });
    await expect(campaigns.changeContactTask(71, campaign.uid, contact.uid, { action: 'exclude' })).rejects.toMatchObject({ status: 409 });
    await activeTask.update({ status: 'pending' });
    await campaigns.changeContactTask(71, campaign.uid, contact.uid, { action: 'exclude' });
    await activeTask.reload();
    expect(activeTask).toMatchObject({ status: 'cancelled', last_disposition: 'excluded' });
    await expect(campaigns.listContacts(72, campaign.uid)).rejects.toMatchObject({ status: 404 });
  });

  it('starts explicit tours without deleting attempt history or resetting lifetime progress', async () => {
    const base = await createBase();
    const contact = await createContact(base.uid, '79009994455');
    const campaign = await AcCampaign.create({ user_uid: 71, base_uid: base.uid, name: 'Tour fixture', dial_mode: 'agentless', pacing: {}, retry: { max_attempts: 2 }, trunk_pool: [{ trunk_id: 'isolated-trunk' }], cid_policy: {}, queue_names: [], scenario_actions: [{ id: 'end', type: 'hangup', params: {} }], amd: {}, revision: 1 });
    const campaigns = campaignService();
    const started = await campaigns.start(71, campaign.uid);
    expect(started.tasks_created).toBe(1);
    expect(started.campaign.tour_no).toBe(1);
    const task = (await AcTask.findOne({ where: { campaign_uid: campaign.uid } }))!;
    await AcAttempt.create({ user_uid: 71, campaign_uid: campaign.uid, task_uid: task.uid, tour_no: 1, attempt_no: 1, started_at: new Date(), ended_at: new Date(), disposition: 'busy' });
    await task.update({ status: 'completed', last_disposition: 'busy', attempt_count: 2 });
    await campaigns.stop(71, campaign.uid);
    const restarted = await campaigns.start(71, campaign.uid, { include_dispositions: ['busy'] });
    expect(restarted.campaign).toMatchObject({ tour_no: 2, tasks_processed: 1 });
    expect(await AcAttempt.count({ where: { task_uid: task.uid } })).toBe(1);
    await task.reload();
    expect(task).toMatchObject({ tour_no: 2, attempt_count: 0, status: 'pending' });
    expect((await campaigns.journal(71, campaign.uid)).map((r) => r.event_type)).toEqual(['tour_started', 'stopped', 'tour_started']);
    await expect(campaigns.start(71, campaign.uid)).rejects.toMatchObject({ status: 409 });
    expect(contact.uid).toBe(task.contact_uid);
  });

  it('limits internal test calls per user and makes retries idempotent without touching campaign tasks', async () => {
    const base = await createBase();
    const contact = await createContact(base.uid, '79009997788');
    const campaign = await AcCampaign.create({ user_uid: 71, base_uid: base.uid, name: 'Internal test fixture', dial_mode: 'agentless', pacing: {}, retry: {}, trunk_pool: [], cid_policy: {}, queue_names: [], scenario_actions: [{ id: 'end', type: 'hangup', params: {} }], amd: {}, revision: 1 });
    await db!.query("INSERT INTO users VALUES (7101, 71, '00991501'), (7201, 72, '00991502')");
    await db!.query("INSERT INTO ps_endpoints VALUES ('e00991501_71', '71')");
    const ari = { originateChannel: jest.fn().mockResolvedValue({}), getAutodialAppName: () => 'isolated', setChannelVar: jest.fn().mockResolvedValue(undefined), continueInDialplan: jest.fn(), hangupChannel: jest.fn().mockResolvedValue(undefined) };
    const writer = { applyCategories: jest.fn().mockResolvedValue({ success: true }), deleteCategories: jest.fn().mockResolvedValue(undefined) };
    const testCalls = new AutodialTestCallService(db!, campaignService(), bases, { validateDraft: async () => undefined } as never, ari as never, writer as never);
    const request = { contact_uid: contact.uid, expected_revision: 1, idempotency_key: 'same-request-001' };
    await expect(testCalls.call(71, 7101, campaign.uid, { ...request, endpoint: 'PJSIP/external-trunk' })).rejects.toMatchObject({ status: 400 });
    await expect(testCalls.call(71, 7201, campaign.uid, request)).rejects.toMatchObject({ status: 403 });
    const first = await testCalls.call(71, 7101, campaign.uid, request);
    const duplicate = await testCalls.call(71, 7101, campaign.uid, request);
    expect(duplicate.uid).toBe(first.uid);
    expect(ari.originateChannel).toHaveBeenCalledTimes(1);
    expect(ari.originateChannel).toHaveBeenCalledWith(expect.objectContaining({ endpoint: 'PJSIP/e00991501_71' }));
    await testCalls.onAnswer({ channel: { id: `actest-${first.uid}`, state: 'Up' } });
    expect(ari.continueInDialplan).toHaveBeenCalledWith(`actest-${first.uid}`, expect.stringMatching(/^krsk-ac-test-/), 's', 1);
    await testCalls.onEnd({ channel: { id: `actest-${first.uid}` } });
    expect(await testCalls.status(71, 7101, campaign.uid, first.uid)).toMatchObject({ status: 'ended', revision: 1, result: { answered: true, delivery: 'not_observed' } });
    await expect(testCalls.status(71, 7201, campaign.uid, first.uid)).rejects.toMatchObject({ status: 404 });
    await expect(testCalls.status(72, 7101, campaign.uid, first.uid)).rejects.toMatchObject({ status: 404 });
    await expect(testCalls.status(71, 7101, campaign.uid + 1, first.uid)).rejects.toMatchObject({ status: 404 });
    expect(writer.deleteCategories).toHaveBeenCalledWith('krasterisk/autodial/ac_test_71.conf', expect.any(Array));
    for (let i = 2; i <= 5; i++) await testCalls.call(71, 7101, campaign.uid, { ...request, idempotency_key: 'test-request-00' + i });
    await expect(testCalls.call(71, 7101, campaign.uid, { ...request, idempotency_key: 'test-request-006' })).rejects.toMatchObject({ response: { code: 'AC_TEST_RATE_LIMIT' } });
    expect(await AcTask.count({ where: { campaign_uid: campaign.uid } })).toBe(0);
    expect(await AcAttempt.count({ where: { campaign_uid: campaign.uid } })).toBe(0);
  });

  it('repairs a late AMD callback and serializes it with a competing ARI finalizer', async () => {
    const base = await createBase(); const contact = await createContact(base.uid);
    const campaign = await AcCampaign.create({ user_uid: 71, base_uid: base.uid, name: 'Late AMD', pacing: {}, retry: { max_attempts: 3, default_interval_sec: 60 }, trunk_pool: [], cid_policy: {}, queue_names: [], scenario_actions: [], amd: {} });
    const task = await AcTask.create({ user_uid: 71, campaign_uid: campaign.uid, contact_uid: contact.uid, phone_uid: contact.phones[0].uid, status: 'dialing', attempt_count: 1 });
    const service = new AutodialAttemptService(AcAttempt, AcTask, AcCampaign, { recordAnsweredOutcome: () => undefined } as never);
    const attempt = await service.openAttempt({ userUid: 71, taskUid: task.uid, campaignUid: campaign.uid, attemptNo: 1, channelId: 'late-amd', trunkId: 'no-call', callerId: null });
    await service.finalize({ attemptUid: attempt.uid, disposition: 'success' });
    await Promise.all([service.markAmdMachine(attempt.uid), service.finalize({ attemptUid: attempt.uid, disposition: 'success' })]);
    expect((await attempt.reload()).disposition).toBe('amd_machine');
    expect((await task.reload()).last_disposition).toBe('amd_machine');
    expect(await AcAttempt.count({ where: { task_uid: task.uid } })).toBe(1);
  });

  it('aggregates report dimensions in tenant time and drills down without leaking another tenant', async () => {
    const base = await bases.create(71, { name: 'Analytics golden', fields: [
      { key: 'phone', label: 'Phone', type: 'phone', required: true }, { key: 'segment', label: 'Segment', type: 'enum', enum_values: ['A', 'B'] },
    ] });
    const campaign = await AcCampaign.create({ user_uid: 71, base_uid: base.uid, name: 'Analytics golden', pacing: {}, retry: {}, trunk_pool: [], cid_policy: {}, queue_names: [], scenario_actions: [], amd: {} });
    const a = await bases.createContact(71, base.uid, { phones: [{ raw: '79000000101' }], values: { segment: 'A' } });
    const b = await bases.createContact(71, base.uid, { phones: [{ raw: '79000000102' }], values: { segment: 'B' } });
    for (const [contact, time, disposition, attemptNo] of [[a, '17:30', 'success', 1], [a, '18:30', 'busy', 2], [b, '19:00', 'amd_machine', 1], [b, '16:59', 'success', 2]] as const) {
      const task = await AcTask.findOrCreate({ where: { campaign_uid: campaign.uid, contact_uid: contact.uid, phone_uid: contact.phones[0].uid },
        defaults: { user_uid: 71, status: 'completed', attempt_count: 2 } });
      await AcAttempt.create({ user_uid: 71, campaign_uid: campaign.uid, task_uid: task[0].uid, channel_id: `golden-${contact.uid}-${attemptNo}`,
        attempt_no: attemptNo, started_at: new Date(`2026-10-16T${time}:00Z`), ended_at: new Date(`2026-10-16T${time}:10Z`),
        answered_at: disposition === 'busy' ? null : new Date(`2026-10-16T${time}:01Z`), disposition, talk_sec: disposition === 'busy' ? 0 : 9,
        billsec: disposition === 'busy' ? 0 : 9, scenario_result: { business_outcome: disposition === 'success' ? 'confirmed' : null } });
    }
    const reports = new AutodialReportsService(AcAttempt, AcCampaign, AcTask, AcContact, AcDailyCampaignStats, db!, new AutodialStateService(),
      { getTenantConfig: async () => ({ timezone: 'Asia/Krasnoyarsk' }) } as never);
    const analytics = new AutodialAnalyticsService(db!, reports);
    const input = { from: '2026-10-17', to: '2026-10-17', campaign_uids: [campaign.uid] };
    const hours = await analytics.breakdown(71, { ...input, dimension: 'hour' });
    expect(hours.rows.map((row) => [row.value, row.dials])).toEqual([['00', 1], ['01', 1], ['02', 1]]);
    const heatmap = await analytics.breakdown(71, { ...input, dimension: 'heatmap' });
    expect(heatmap.rows[0].value).toBe('6:00');
    const fieldUid = base.fields.find((field) => field.key === 'segment')!.uid;
    const segments = await analytics.breakdown(71, { ...input, dimension: 'segment', field_uid: fieldUid });
    expect(segments.rows.map((row) => [row.value, row.dials])).toEqual([['A', 2], ['B', 1]]);
    expect((await analytics.detail(71, { ...input, dimension: 'segment', field_uid: fieldUid, value: 'A' })).rows).toHaveLength(2);
    expect((await analytics.detail(71, { ...input, dimension: 'disposition', value: 'success' })).rows).toHaveLength(1);
    expect((await analytics.breakdown(72, { ...input, dimension: 'disposition' })).rows).toHaveLength(0);
    await expect(analytics.breakdown(72, { ...input, dimension: 'segment', field_uid: fieldUid })).rejects.toMatchObject({ status: 404 });
  });

  it('creates DNC with a real ORM timestamp and applies tenant isolation', async () => {
    const dnc = new AutodialDncService(AcDnc, AcBase, AcCampaign);
    const created = await dnc.create(71, { scope: 'global', normalized_phone: '79009990001' });
    expect((await AcDnc.findByPk(created.uid))?.created_at).toBeInstanceOf(Date);
    expect(await dnc.isBlocked(71, '89009990001')).toBe(true);
    expect(await dnc.isBlocked(72, '79009990001')).toBe(false);
  });

  it('serializes simultaneous manual inserts under the base dedup policy', async () => {
    const base = await createBase();
    const outcomes = await Promise.allSettled([createContact(base.uid), createContact(base.uid)]);
    expect(outcomes.filter((result) => result.status === 'fulfilled')).toHaveLength(1);
    expect(await AcContact.count({ where: { base_uid: base.uid } })).toBe(1);
  });

  it('allows only one active attempt for a normalized number across campaigns', async () => {
    const base = await createBase();
    const contact = await createContact(base.uid);
    const campaigns = await Promise.all([1, 2].map((i) => AcCampaign.create({
      user_uid: 71, base_uid: base.uid, name: `Mutex ${i}`, pacing: {}, retry: {}, trunk_pool: [],
      cid_policy: {}, queue_names: [], scenario_actions: [], amd: {},
    })));
    const tasks = await Promise.all(campaigns.map((campaign) => AcTask.create({
      user_uid: 71, campaign_uid: campaign.uid, contact_uid: contact.uid, phone_uid: contact.phones[0].uid,
      status: 'leased', leased_by: 'mutex-test',
    })));
    const attempts = new AutodialAttemptService(AcAttempt, AcTask, AcCampaign, {} as never);
    const results = await Promise.all(tasks.map((task) => attempts.claimAndOpenAttempt({
      userUid: 71, taskUid: task.uid, campaignUid: task.campaign_uid, attemptNo: 1,
      channelId: `mutex-${task.uid}`, trunkId: 'isolated-no-call', callerId: null,
      leaseId: 'mutex-test', normalizedPhone: contact.phones[0].normalized,
    })));
    expect(results.filter(Boolean)).toHaveLength(1);
    expect(await AcAttempt.count({ where: { channel_id: tasks.map((task) => `mutex-${task.uid}`) } })).toBe(1);
  });

  it('shares the active-number fence across bases with different presentation policies', async () => {
    const firstBase = await createBase();
    const secondBase = await bases.create(71, { name: 'Raw phone ' + (++sequence), phone_normalization: 'none', fields: [
      { key: 'name', label: 'Name', type: 'string', required: true }, { key: 'phone', label: 'Phone', type: 'phone', required: true },
    ] });
    const contacts = [await createContact(firstBase.uid, '79001234568'), await createContact(secondBase.uid, '8 (900) 123-45-68')];
    const tasks = [] as AcTask[];
    for (const contact of contacts) {
      const campaign = await AcCampaign.create({ user_uid: 71, base_uid: contact.base_uid, name: `Canonical mutex ${contact.uid}`, pacing: {}, retry: {}, trunk_pool: [], cid_policy: {}, queue_names: [], scenario_actions: [], amd: {} });
      tasks.push(await AcTask.create({ user_uid: 71, campaign_uid: campaign.uid, contact_uid: contact.uid, phone_uid: contact.phones[0].uid, status: 'leased', leased_by: 'canonical-test' }));
    }
    expect(contacts[0].phones[0].normalized).not.toBe(contacts[1].phones[0].normalized);
    const attempts = new AutodialAttemptService(AcAttempt, AcTask, AcCampaign, {} as never);
    const claimed = await Promise.all(tasks.map((task, index) => attempts.claimAndOpenAttempt({ userUid: 71, taskUid: task.uid,
      campaignUid: task.campaign_uid, attemptNo: 1, channelId: `canonical-${task.uid}`, trunkId: 'no-call', callerId: null,
      leaseId: 'canonical-test', normalizedPhone: contacts[index].phones[0].normalized })));
    expect(claimed.filter(Boolean)).toHaveLength(1);
  });

  it('creates required-phone contacts and preserves values/UIDs across label changes', async () => {
    const base = await createBase();
    const contact = await createContact(base.uid);
    const current = await bases.findOne(71, base.uid);
    await bases.update(71, base.uid, {
      revision: current.revision,
      fields: current.fields.map((field, i) => ({ ...field, enum_values: undefined, label: 'Label ' + i, position: 1 - i })),
    });
    const result = await bases.findContact(71, base.uid, contact.uid);
    expect(result.values).toEqual({ name: 'Alice' });
    expect(result.phones[0].uid).toBe(contact.phones[0].uid);
    expect((await bases.findOne(71, base.uid)).fields.map((field) => field.uid).sort()).toEqual(base.fields.map((field) => field.uid).sort());
  });

  it('adds enum choices to a populated base without changing stored values', async () => {
    const base = await bases.create(71, { name: 'Enum ' + (++sequence), fields: [
      { key: 'phone', label: 'Phone', type: 'phone', required: true },
      { key: 'segment', label: 'Segment', type: 'enum', enum_values: ['A'] },
    ] });
    const contact = await bases.createContact(71, base.uid, { values: { segment: 'A' }, phones: [{ raw: '79009995566' }] });
    const current = await bases.findOne(71, base.uid);
    const updated = await bases.update(71, base.uid, { revision: current.revision,
      fields: base.fields.map((f) => ({ uid: f.uid, key: f.key, label: f.label, type: f.type,
        required: f.required, var_name: f.var_name, ...(f.type === 'enum' ? { enum_values: ['A', 'B'] } : {}) })),
    });
    expect(updated.fields.find((f) => f.key === 'segment')?.enum_values).toEqual(['A', 'B']);
    expect((await bases.findContact(71, base.uid, contact.uid)).values.segment).toBe('A');
  });

  it('previews and atomically migrates typed values, archives originals and rewrites references', async () => {
    const base = await bases.create(71, { name: 'Schema migration ' + (++sequence), fields: [
      { key: 'phone', label: 'Phone', type: 'phone', required: true }, { key: 'name', label: 'Name', type: 'string' },
      { key: 'amount', label: 'Amount', type: 'string' }, { key: 'obsolete', label: 'Old field', type: 'string' },
    ] });
    const contact = await bases.createContact(71, base.uid, { values: { name: 'Alice', amount: '15 240,50', obsolete: 'keep me' }, phones: [{ raw: '79009998877' }] });
    const campaign = await AcCampaign.create({ user_uid: 71, base_uid: base.uid, name: 'Schema reference', pacing: {}, retry: {}, trunk_pool: [], cid_policy: {}, queue_names: [],
      scenario_actions: [{ id: 'say', type: 'text2speech', params: { text: 'Hello {AC_NAME}', engine: 3 } }], amd: {}, revision: 1 });
    const profile = await AcImportProfile.create({ user_uid: 71, base_uid: base.uid, name: 'CRM', column_map: [{ column: 'Customer', field_key: 'name' }] });
    const schemaService = new AutodialSchemaService(db!, AcBase, AcBaseField, AcContact, AcCampaign, AcImportProfile, bases);
    const current = await bases.findOne(71, base.uid);
    const fields = current.fields.filter((field) => field.key !== 'obsolete').map(({ base_uid: _baseUid, ...field }) => ({ ...field,
      ...(field.key === 'name' ? { key: 'full_name', var_name: 'AC_FULL_NAME' } : {}), ...(field.key === 'amount' ? { type: 'money' as const } : {}),
    }));
    const request = { expected_revision: current.revision, fields };
    const preview = await schemaService.preview(71, base.uid, request);
    expect(preview).toMatchObject({ ready: true, scanned_contacts: 1, archived_values: 2, error_count: 0 });
    const migrated = await schemaService.apply(71, 7101, base.uid, { ...request, preview_hash: preview.preview_hash });
    expect(migrated.revision).toBe(current.revision + 1);
    const result = await bases.findContact(71, base.uid, contact.uid);
    expect(result.values).toEqual({ full_name: 'Alice', amount: 15240.5 });
    expect(result.phones[0].uid).toBe(contact.phones[0].uid);
    await campaign.reload(); await profile.reload();
    expect(campaign.scenario_actions[0].params.text).toBe('Hello {AC_FULL_NAME}');
    expect(profile.column_map[0].field_key).toBe('full_name');
    const [archive] = await db!.query(`SELECT JSON_UNQUOTE(archived_value) AS value FROM ac_field_archive WHERE base_uid = ${base.uid} ORDER BY uid`);
    expect(archive.map((row: { value: string }) => row.value).sort()).toEqual(['15 240,50', 'keep me']);
    await expect(schemaService.apply(71, 7101, base.uid, { ...request, preview_hash: preview.preview_hash })).rejects.toMatchObject({ response: { code: 'AC_REVISION_CONFLICT' } });
    await expect(schemaService.preview(72, base.uid, request)).rejects.toMatchObject({ status: 404 });
  });

  it('rolls schema, archive and values back together when a data write fails', async () => {
    const base = await bases.create(71, { name: 'Schema rollback ' + (++sequence), fields: [
      { key: 'phone', label: 'Phone', type: 'phone', required: true }, { key: 'amount', label: 'Amount', type: 'string' },
    ] });
    const contact = await bases.createContact(71, base.uid, { values: { amount: '12,50' }, phones: [{ raw: '79009998878' }] });
    const schemaService = new AutodialSchemaService(db!, AcBase, AcBaseField, AcContact, AcCampaign, AcImportProfile, bases);
    const current = await bases.findOne(71, base.uid);
    const fields = current.fields.map(({ base_uid: _baseUid, ...field }) => ({ ...field, ...(field.key === 'amount' ? { type: 'money' as const } : {}) }));
    const request = { expected_revision: current.revision, fields };
    const preview = await schemaService.preview(71, base.uid, request);
    const fail = jest.spyOn(AcContact, 'bulkCreate').mockRejectedValueOnce(new Error('isolated rollback failure'));
    try { await expect(schemaService.apply(71, 7101, base.uid, { ...request, preview_hash: preview.preview_hash })).rejects.toThrow('isolated rollback failure'); }
    finally { fail.mockRestore(); }
    expect((await bases.findOne(71, base.uid)).revision).toBe(current.revision);
    expect((await bases.findOne(71, base.uid)).fields.find((field) => field.key === 'amount')?.type).toBe('string');
    expect((await bases.findContact(71, base.uid, contact.uid)).values.amount).toBe('12,50');
    const [archive] = await db!.query(`SELECT COUNT(*) AS count FROM ac_field_archive WHERE base_uid = ${base.uid}`);
    expect(Number(archive[0].count)).toBe(0);
  });
  it('deletes an unused base together with fields, contacts and phones', async () => {
    const base = await createBase();
    const contact = await createContact(base.uid);

    await bases.remove(71, base.uid);

    expect(await AcBase.count({ where: { uid: base.uid } })).toBe(0);
    expect(await AcBaseField.count({ where: { base_uid: base.uid } })).toBe(0);
    expect(await AcContact.count({ where: { uid: contact.uid } })).toBe(0);
    expect(await AcContactPhone.count({ where: { base_uid: base.uid } })).toBe(0);
  });
  it('persists answer correlation for a replacement worker', async () => {
    const base = await createBase();
    const contact = await createContact(base.uid);
    const campaign = await AcCampaign.create({
      user_uid: 71, base_uid: base.uid, name: 'Recovery fixture', pacing: {}, retry: {}, trunk_pool: [],
      cid_policy: {}, queue_names: [], scenario_actions: [], amd: {},
    });
    const task = await AcTask.create({
      user_uid: 71, campaign_uid: campaign.uid,
      contact_uid: contact.uid, phone_uid: contact.phones[0].uid,
    });
    const attempts = new AutodialAttemptService(
      AcAttempt, AcTask, AcCampaign, { recordAnsweredOutcome: jest.fn() } as never,
    );
    const channelId = `ac-${campaign.uid}-${task.uid}-1`;
    const opened = await attempts.openAttempt({
      userUid: 71, taskUid: task.uid, campaignUid: campaign.uid,
      attemptNo: 1, channelId, trunkId: 'fixture', callerId: '74951112233',
    });
    const answeredAt = new Date('2026-09-18T10:00:20Z');

    await attempts.markAnswered(channelId, answeredAt);
    await attempts.markAnswered(channelId, new Date('2026-09-18T10:01:00Z'));

    const recovered = await attempts.findOpenByChannelId(channelId);
    expect(recovered?.uid).toBe(opened.uid);
    expect(recovered?.answered_at?.getTime()).toBe(answeredAt.getTime());
  });
  it('counts contacts, loads a contact outside page 1 and isolates tenants', async () => {
    const base = await createBase();
    const first = await createContact(base.uid);
    const fieldUid = base.fields.find((field) => field.key === 'name')!.uid;
    await AcContact.bulkCreate(Array.from({ length: 60 }, (_, i) => ({
      base_uid: base.uid, user_uid: 71, values: { [fieldUid]: 'Contact ' + i },
    })));
    await AcContactPhone.create({ contact_uid: first.uid, base_uid: base.uid, raw: '79001234568', normalized: '79001234568' });
    const page = await bases.listContacts(71, base.uid, { page: 1, pageSize: 25 });
    expect(page.total).toBe(61);
    expect(page.items.some((row) => row.uid === first.uid)).toBe(false);
    expect((await bases.findContact(71, base.uid, first.uid)).phones).toHaveLength(2);
    await expect(bases.findContact(72, base.uid, first.uid)).rejects.toThrow();
    const foreignBase = await createBase(72);
    await expect(bases.findContact(71, foreignBase.uid, first.uid)).rejects.toThrow();
  });
  it('validates replacement and exports rejected rows without changing contacts, phones, revision or import history', async () => {
    const base = await createBase(); const contact = await createContact(base.uid);
    const before = await bases.findOne(71, base.uid);
    const options = { ...upload('name;phone\nAlice;79001234568\n=unsafe;invalid'), replace: true,
      expected_revision: before.revision, validation_only: true as const };
    const validation = await importer.importFile(71, base.uid, options);
    expect(validation).toMatchObject({ ready: false, valid: 1, skipped: 1, total_rows: 2 });
    expect(validation.rejected_rows[0]).toMatchObject({ row: 3, values: ['=unsafe', 'invalid'] });
    const ExcelJS = await import('exceljs'); const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(await importer.rejectedFile(71, base.uid, options) as never);
    expect(workbook.worksheets[0].getCell('C2').value).toBe('=unsafe');
    expect((await bases.findOne(71, base.uid)).revision).toBe(before.revision);
    expect(await AcContact.count({ where: { base_uid: base.uid } })).toBe(1);
    expect(await AcContactPhone.count({ where: { contact_uid: contact.uid } })).toBe(1);
    expect(await AcImportRun.count({ where: { base_uid: base.uid } })).toBe(0);
  });

  it('rolls back metadata together with a rejected schema change', async () => {
    const base = await createBase();
    await createContact(base.uid);
    const before = await bases.findOne(71, base.uid);
    await expect(bases.update(71, base.uid, {
      name: 'should-not-persist', fields: [{ key: 'phone', label: 'Phone', type: 'phone' }],
    })).rejects.toThrow();
    expect(await bases.findOne(71, base.uid)).toMatchObject({ name: before.name, revision: before.revision });
  });
  it('serializes optimistic revision checks', async () => {
    const base = await createBase();
    const outcomes = await Promise.allSettled([
      bases.update(71, base.uid, { revision: base.revision, description: 'one' }),
      bases.update(71, base.uid, { revision: base.revision, description: 'two' }),
    ]);
    expect(outcomes.filter((result) => result.status === 'fulfilled')).toHaveLength(1);
  });
  it('preserves phone identity, clears optional fields and refuses changing a tasked number', async () => {
    const base = await createBase();
    const contact = await createContact(base.uid);
    const result = await bases.updateContact(71, base.uid, contact.uid, { comment: '', external_id: null });
    expect(result).toMatchObject({ comment: '', external_id: null, phones: [{ uid: contact.phones[0].uid }] });
    const campaign = await AcCampaign.create({
      user_uid: 71, base_uid: base.uid, name: 'Fixture', pacing: {}, retry: {}, trunk_pool: [],
      cid_policy: {}, queue_names: [], scenario_actions: [], amd: {},
    });
    await AcTask.create({ user_uid: 71, campaign_uid: campaign.uid, contact_uid: contact.uid, phone_uid: contact.phones[0].uid });
    await expect(bases.updateContact(71, base.uid, contact.uid, {
      comment: 'must-roll-back', phones: [{ uid: contact.phones[0].uid, raw: '79000000000' }],
    })).rejects.toThrow();
    expect((await bases.findContact(71, base.uid, contact.uid)).comment).toBe('');
    await expect(bases.deleteContact(71, base.uid, contact.uid)).rejects.toThrow();
  });
  it('deduplicates within the file and against existing data with consistent row counts', async () => {
    const base = await createBase();
    await createContact(base.uid);
    const result = await importer.importFile(71, base.uid, upload('name;phone\nAlice;79001234567\nBob;79001234568\nBob2;79001234568'));
    expect(result).toMatchObject({ imported: 1, skipped: 2 });
    expect((await bases.listContacts(71, base.uid)).total).toBe(2);
  });
  it('does not delete contacts when replacement has invalid rows or a stale preview', async () => {
    const base = await createBase();
    await createContact(base.uid);
    const current = await bases.findOne(71, base.uid);
    await expect(importer.importFile(71, base.uid, {
      ...upload('name;phone\n;79001234568'), replace: true, expected_revision: current.revision,
    })).rejects.toThrow();
    await expect(importer.importFile(71, base.uid, {
      ...upload('name;phone\nBob;79001234568'), replace: true, expected_revision: 0,
    })).rejects.toThrow();
    expect((await bases.listContacts(71, base.uid)).items[0].values.name).toBe('Alice');
  });
  it('rolls replacement back if phone insertion fails after deleting contacts', async () => {
    const base = await createBase();
    const contact = await createContact(base.uid);
    const current = await bases.findOne(71, base.uid);
    const failure = jest.spyOn(AcContactPhone, 'bulkCreate').mockRejectedValueOnce(new Error('injected write failure'));
    try {
      await expect(importer.importFile(71, base.uid, {
        ...upload('name;phone\nBob;79001234568'), replace: true, expected_revision: current.revision,
      })).rejects.toThrow('injected write failure');
    } finally { failure.mockRestore(); }
    expect((await bases.findContact(71, base.uid, contact.uid)).phones[0].uid).toBe(contact.phones[0].uid);
    expect((await bases.findOne(71, base.uid)).revision).toBe(current.revision);
  });
  it('deduplicates external IDs against the stored base', async () => {
    const base = await createBase();
    await createContact(base.uid);
    const result = await importer.importFile(71, base.uid, {
      ...upload('name;phone;id\nBob;79001234568;old'), dedup_policy: 'external_id',
      column_map: [...upload('').column_map, { column: 'id', field_key: '__external_id' }],
    });
    expect(result).toMatchObject({ imported: 0, skipped: 1 });
  });

  it('copies report customers atomically with new field/phone identities and conservative scoped DNC', async () => {
    const base = await createBase();
    const contact = await createContact(base.uid, '79009990001');
    const current = await bases.findOne(71, base.uid);
    const campaign = await AcCampaign.create({ user_uid: 71, base_uid: base.uid, name: 'Selection source', pacing: {}, retry: {},
      trunk_pool: [], cid_policy: {}, queue_names: [], scenario_actions: [], amd: {} });
    await AcDnc.bulkCreate([
      { user_uid: 71, scope: 'base', scope_uid: base.uid, normalized_phone: '79009990001', reason: 'permanent', expires_at: null },
      { user_uid: 71, scope: 'campaign', scope_uid: campaign.uid, normalized_phone: '79009990001', reason: 'temporary', expires_at: new Date(Date.now() + 86400000) },
      { user_uid: 72, scope: 'base', scope_uid: base.uid, normalized_phone: '79009990002', reason: 'foreign', expires_at: null },
    ]);
    const copy = await bases.cloneContacts(71, base.uid, [contact.uid, contact.uid], 'Selection copy', current.revision, campaign.uid);
    const copied = (await bases.listContacts(71, copy.uid)).items;
    expect(copied).toHaveLength(1);
    expect(copied[0]).toMatchObject({ external_id: 'old', comment: 'before', values: { name: 'Alice' }, phones: [{ normalized: '79009990001' }] });
    expect(copied[0].uid).not.toBe(contact.uid);
    expect(copied[0].phones[0].uid).not.toBe(contact.phones[0].uid);
    expect(copy.fields[0].uid).not.toBe(base.fields[0].uid);
    const bans = await AcDnc.findAll({ where: { user_uid: 71, scope: 'base', scope_uid: copy.uid } });
    expect(bans).toHaveLength(1); expect(bans[0]).toMatchObject({ normalized_phone: '79009990001', expires_at: null });
    expect(await AcTask.count({ where: { contact_uid: copied[0].uid } })).toBe(0);
    expect((await bases.listContacts(71, copy.uid, { q: 'Alice' })).total).toBe(1);
    expect((await bases.listContacts(71, copy.uid, { q: '9990001' })).total).toBe(1);
    expect((await bases.listContacts(71, copy.uid, { q: 'Missing' })).total).toBe(0);
    await expect(bases.cloneContacts(72, base.uid, [contact.uid], 'Foreign', current.revision, campaign.uid)).rejects.toMatchObject({ status: 404 });
    await expect(bases.cloneContacts(71, base.uid, [contact.uid], 'Stale', current.revision - 1, campaign.uid)).rejects.toMatchObject({ status: 409 });
    const failure = jest.spyOn(AcContactPhone, 'bulkCreate').mockRejectedValueOnce(new Error('copy rollback'));
    try { await expect(bases.cloneContacts(71, base.uid, [contact.uid], 'Failed selection', current.revision, campaign.uid)).rejects.toThrow('copy rollback'); }
    finally { failure.mockRestore(); }
    expect(await AcBase.count({ where: { name: 'Failed selection' } })).toBe(0);
    await bases.remove(71, copy.uid);
    expect(await AcDnc.count({ where: { user_uid: 71, scope: 'base', scope_uid: copy.uid } })).toBe(0);
  });

  it('rejects report copy when preview changes and refuses read-only users', async () => {
    const base = await createBase(), contact = await createContact(base.uid, '79009990003');
    const campaign = await AcCampaign.create({ user_uid: 71, base_uid: base.uid, name: 'Selection preview source', pacing: {}, retry: {},
      trunk_pool: [], cid_policy: {}, queue_names: [], scenario_actions: [], amd: {} });
    const service = new AutodialReportSelectionService({ selectedContactIds: async () => [contact.uid] } as never, bases, campaignService());
    const filter = { from: '2026-10-01', to: '2026-10-17', campaign_uids: [campaign.uid], dimension: 'disposition', value: 'busy' };
    const preview = await service.preview(71, filter);
    const request = { filter, name: 'Selection preview copy', preview_hash: preview.preview_hash };
    await expect(service.createBase(71, 4, request)).rejects.toMatchObject({ status: 403 });
    await expect(service.preview(72, filter)).rejects.toMatchObject({ status: 404 });
    await bases.updateContact(71, base.uid, contact.uid, { comment: 'edited after preview' });
    await expect(service.createBase(71, 1, request)).rejects.toMatchObject({ status: 409 });
    expect(await AcBase.count({ where: { name: request.name } })).toBe(0);
  });

  it('persists scoped keys, replay-safe bulk upsert, restart-safe imports and normalized DNC without making calls', async () => {
    await db!.query('ALTER TABLE users ADD COLUMN level INT NOT NULL DEFAULT 1');
    await db!.query("INSERT INTO users (uniqueid, vpbx_user_uid, exten, level) VALUES (7102, 71, '00991503', 1)");
    const keys = new AutodialIntegrationKeyService(db!, { tenantHasModule: async () => true } as never);
    const receipt = await keys.create(71, 7102, 1, { label: 'Isolated CRM', scopes: ['autodial:read', 'autodial:contacts:write', 'autodial:imports:write', 'autodial:dnc:write', 'autodial:webhooks:write'],
      expires_at: new Date(Date.now() + 86400000).toISOString() });
    expect(JSON.stringify(await keys.list(71, 1))).not.toContain(receipt.token);
    await expect(keys.create(71, 7102, 3, {})).rejects.toMatchObject({ status: 403 });
    const actor = await keys.authenticate(receipt.token);
    const crm = new AutodialCrmService(db!, bases, importer, new AutodialDncService(AcDnc, AcBase, AcCampaign), keys);
    const base = await createBase();
    const request = { contacts: [{ external_id: 'crm-customer-1', values: { name: 'CRM customer' }, phones: [{ raw: '8 (900) 999-00-04' }] }] };
    const first = await crm.upsert(actor, base.uid, 'crm-bulk-request-1', request);
    const replay = await crm.upsert(actor, base.uid, 'crm-bulk-request-1', request);
    expect(replay).toEqual(first);
    expect((await bases.listContacts(71, base.uid)).total).toBe(1);
    const updated = await crm.upsert(actor, base.uid, 'crm-bulk-request-2', { contacts: [{ ...request.contacts[0], values: { name: 'Updated CRM customer' } }] });
    expect(updated.contacts[0].uid).toBe(first.contacts[0].uid);
    expect((await bases.listContacts(71, base.uid)).items[0].values.name).toBe('Updated CRM customer');
    await expect(crm.upsert(actor, base.uid, 'crm-bulk-request-1', { ...request, expected_revision: 0 })).rejects.toMatchObject({ status: 409 });
    await expect(crm.upsert(actor, base.uid, 'crm-bulk-invalid', { contacts: [request.contacts[0], { ...request.contacts[0], external_id: 'other', phones: [{ raw: 'invalid' }] }] })).rejects.toMatchObject({ status: 400 });
    expect((await bases.listContacts(71, base.uid)).total).toBe(1);
    const current = await bases.findOne(71, base.uid);
    const imported = await crm.enqueueImport(actor, base.uid, 'crm-import-request-1', { filename: 'crm.csv', source: 'csv',
      content_base64: Buffer.from('name;phone\nImported CRM;79009990005').toString('base64'), expected_revision: current.revision,
      column_map: [{ column: 'name', field_key: 'name' }, { column: 'phone', field_key: '__phone' }] });
    expect((await crm.job(actor, imported.uid)).status).toBe('pending');
    // A replacement worker discovers the durable row, with no in-memory queue to recover.
    const replacement = new AutodialCrmService(db!, bases, importer, new AutodialDncService(AcDnc, AcBase, AcCampaign), keys);
    await replacement.processNextImport();
    expect((await crm.job(actor, imported.uid)).status).toBe('succeeded');
    await replacement.processNextImport();
    expect((await bases.listContacts(71, base.uid)).total).toBe(2);
    await expect(crm.enqueueImport(actor, base.uid, 'crm-import-replace', { replace: true })).rejects.toMatchObject({ status: 400 });
    const dnc = { scope: 'base', scope_uid: base.uid, phones: ['89009990004', '+79009990004'], reason: 'CRM opt-out' };
    expect(await crm.dncBulk(actor, 'crm-dnc-request-1', dnc)).toEqual({ accepted: 1, duplicates: 1 });
    expect(await crm.dncBulk(actor, 'crm-dnc-request-1', dnc)).toEqual({ accepted: 1, duplicates: 1 });
    expect(await new AutodialDncService(AcDnc, AcBase, AcCampaign).isBlocked(71, '79009990004', { baseUid: base.uid })).toBe(true);
    const hooks = new AutodialWebhooksService(db!, { get: () => 'test-only-webhook-secret-at-least-32-characters' } as never, keys);
    const hook = await hooks.create(actor, { url: 'https://example.com/autodial-isolated-test' });
    expect(JSON.stringify(await hooks.list(actor))).not.toContain(hook.secret);
    const campaign = await AcCampaign.create({ user_uid: 71, base_uid: base.uid, name: 'Webhook outbox fixture', pacing: {}, retry: {}, trunk_pool: [], cid_policy: {}, queue_names: [], scenario_actions: [], amd: {} });
    const customer = (await bases.listContacts(71, base.uid)).items.find((row) => row.uid === first.contacts[0].uid)!;
    const task = await AcTask.create({ user_uid: 71, campaign_uid: campaign.uid, contact_uid: customer.uid, phone_uid: customer.phones[0].uid });
    const attempts = new AutodialAttemptService(AcAttempt, AcTask, AcCampaign, { recordAnsweredOutcome: () => undefined } as never, hooks);
    const attempt = await attempts.openAttempt({ userUid: 71, campaignUid: campaign.uid, taskUid: task.uid, attemptNo: 1, channelId: 'outbox-no-originate', trunkId: 'no-call', callerId: null });
    await attempts.finalize({ attemptUid: attempt.uid, disposition: 'busy' });
    await attempts.finalize({ attemptUid: attempt.uid, disposition: 'busy' });
    expect(await hooks.deliveries(actor, hook.uid)).toHaveLength(1);
    // No HTTP sender is invoked by this DB test. Disable before any worker can deliver.
    await hooks.disable(actor, hook.uid);
    await hooks.deliverNext();
    expect((await hooks.deliveries(actor, hook.uid))[0]).toMatchObject({ status: 'cancelled' });
    await keys.revoke(71, 1, receipt.uid);
    await expect(keys.authenticate(receipt.token)).rejects.toMatchObject({ status: 401 });
    await expect(keys.revoke(72, 1, receipt.uid)).rejects.toMatchObject({ status: 404 });
    expect(await AcAttempt.count({ where: { campaign_uid: campaign.uid } })).toBe(1);
  });
});
