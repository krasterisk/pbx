import { randomBytes } from 'node:crypto';
import { resolve } from 'node:path';
import { config } from 'dotenv';
import { createConnection, type Connection } from 'mysql2/promise';
import { Sequelize } from 'sequelize-typescript';
import { AUTODIAL_SCHEMA_STATEMENTS } from './setup-autodial-schema';
import { AutodialBasesService } from './autodial-bases.service';
import { AutodialImportService } from './autodial-import.service';
import { AcBase } from './models/ac-base.model';
import { AcBaseField } from './models/ac-base-field.model';
import { AcContact } from './models/ac-contact.model';
import { AcContactPhone } from './models/ac-contact-phone.model';
import { AcCampaign } from './models/ac-campaign.model';
import { AcTask } from './models/ac-task.model';
import { AcImportProfile } from './models/ac-import-profile.model';
import { AcImportRun } from './models/ac-import-run.model';

// Opt-in only. Existing databases/tables are never written, truncated or dropped.
const databaseTests = process.env.AUTODIAL_DB_INTEGRATION === '1' ? describe : describe.skip;
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
      models: [AcBase, AcBaseField, AcContact, AcContactPhone, AcCampaign, AcTask, AcImportProfile, AcImportRun],
    });
    for (const statement of AUTODIAL_SCHEMA_STATEMENTS) await db.query(statement);
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
});
