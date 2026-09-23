import { AutodialBasesService } from './autodial-bases.service';
import { AcBase } from './models/ac-base.model';
import { AcBaseField } from './models/ac-base-field.model';
import { AcContact } from './models/ac-contact.model';
import { AcContactPhone } from './models/ac-contact-phone.model';
import { AcTask } from './models/ac-task.model';
import { AcCampaign } from './models/ac-campaign.model';
import { AcImportProfile } from './models/ac-import-profile.model';
import { Sequelize } from 'sequelize-typescript';

function setup() {
  const transaction = { LOCK: { UPDATE: 'UPDATE' } };
  const field = {
    uid: 11, base_uid: 1, key: 'name', label: 'Name', type: 'string', required: false,
    is_phone: false, var_name: 'AC_NAME', enum_values: null, position: 0, update: jest.fn().mockResolvedValue(undefined),
  };
  const phoneField = { ...field, uid: 12, key: 'phone', type: 'phone', is_phone: true, required: true, var_name: 'AC_PHONE', update: jest.fn() };
  const phone = { uid: 51, contact_uid: 61, base_uid: 1, raw: '123', normalized: '123', is_primary: true, tz_offset_min: 0, position: 0, update: jest.fn() };
  const contact = { uid: 61, base_uid: 1, user_uid: 7, external_id: 'old', values: { '11': 'Alice' }, comment: 'before', phones: [phone], update: jest.fn() };
  const base = { uid: 1, user_uid: 7, name: 'Base', revision: 3, phone_normalization: 'digits', fields: [field, phoneField], update: jest.fn(), increment: jest.fn() };
  const bases = { findOne: jest.fn().mockResolvedValue(base), findByPk: jest.fn().mockResolvedValue(base) };
  const fields = { findAll: jest.fn().mockResolvedValue(base.fields), create: jest.fn(), destroy: jest.fn() };
  const contacts = { findOne: jest.fn().mockResolvedValue(contact), findByPk: jest.fn().mockResolvedValue(contact), count: jest.fn().mockResolvedValue(1), findAndCountAll: jest.fn().mockResolvedValue({ rows: [contact], count: 1 }), destroy: jest.fn() };
  const phones = { destroy: jest.fn(), create: jest.fn(), bulkCreate: jest.fn() };
  const tasks = { count: jest.fn().mockResolvedValue(0) };
  const campaigns = { count: jest.fn().mockResolvedValue(0) };
  const profiles = { count: jest.fn().mockResolvedValue(0) };
  const db = { transaction: jest.fn((fn) => fn(transaction)) };
  const service = new AutodialBasesService(bases as unknown as typeof AcBase, fields as unknown as typeof AcBaseField,
    contacts as unknown as typeof AcContact, phones as unknown as typeof AcContactPhone, db as unknown as Sequelize,
    tasks as unknown as typeof AcTask, campaigns as unknown as typeof AcCampaign, profiles as unknown as typeof AcImportProfile);
  return { service, base, bases, field, phoneField, fields, contact, contacts, phone, phones, tasks, campaigns, profiles, transaction };
}

describe('AutodialBasesService data identity', () => {
  it('returns the actual items contract and counts distinct contacts', async () => {
    const s = setup();
    const page = await s.service.listContacts(7, 1, { page: 3, pageSize: 25 });
    expect(page).toMatchObject({ total: 1, page: 3, page_size: 25, items: [{ uid: 61, values: { name: 'Alice' } }] });
    expect(s.contacts.findAndCountAll).toHaveBeenCalledWith(expect.objectContaining({ distinct: true, offset: 50 }));
  });
  it('loads contact 61 directly using tenant, base and contact identities', async () => {
    const s = setup();
    await s.service.findContact(7, 1, 61);
    expect(s.contacts.findOne).toHaveBeenCalledWith(expect.objectContaining({ where: { uid: 61, base_uid: 1, user_uid: 7 } }));
    expect(s.contacts.findAndCountAll).not.toHaveBeenCalled();
  });
  it('does not query contacts in an inaccessible base', async () => {
    const s = setup();
    s.bases.findOne.mockResolvedValue(null);
    await expect(s.service.findContact(8, 1, 61)).rejects.toThrow();
    expect(s.contacts.findOne).not.toHaveBeenCalled();
  });
  it('preserves field UID when labels and order change', async () => {
    const s = setup();
    await s.service.update(7, 1, { revision: 3, fields: [{ ...s.phoneField, position: 0 }, { ...s.field, label: 'New label', position: 1 }] });
    expect(s.fields.destroy).not.toHaveBeenCalled();
    expect(s.fields.create).not.toHaveBeenCalled();
    expect(s.field.update).toHaveBeenCalledWith(expect.objectContaining({ label: 'New label', position: 1 }), { transaction: s.transaction });
  });
  it('preserves UID for legacy schema clients sending only keys', async () => {
    const s = setup();
    const { uid: _uid, ...legacy } = s.field;
    await s.service.update(7, 1, { fields: [legacy, s.phoneField] });
    expect(s.field.update).toHaveBeenCalled();
    expect(s.fields.destroy).not.toHaveBeenCalled();
  });
  it('rejects stale revisions before updating', async () => {
    const s = setup();
    await expect(s.service.update(7, 1, { revision: 2, name: 'Changed' })).rejects.toMatchObject({ response: { code: 'AC_REVISION_CONFLICT' } });
    expect(s.base.update).not.toHaveBeenCalled();
  });
  it('rejects removing fields in a populated base and foreign UIDs', async () => {
    const s = setup();
    await expect(s.service.update(7, 1, { fields: [s.phoneField] })).rejects.toMatchObject({ response: { code: 'AC_SCHEMA_IN_USE' } });
    await expect(s.service.update(7, 1, { fields: [{ ...s.field, uid: 999 }, s.phoneField] })).rejects.toMatchObject({ response: { code: 'AC_FIELD_UID' } });
    expect(s.fields.destroy).not.toHaveBeenCalled();
  });
  it('preserves phone UID on comment-only update and clears optional text', async () => {
    const s = setup();
    await s.service.updateContact(7, 1, 61, { comment: '', external_id: null });
    expect(s.contact.update).toHaveBeenCalledWith(expect.objectContaining({ comment: '', external_id: null }), { transaction: s.transaction });
    expect(s.phone.update).toHaveBeenCalled();
    expect(s.phones.destroy).not.toHaveBeenCalled();
    expect(s.phones.create).not.toHaveBeenCalled();
  });
  it('matches legacy phones by normalized identity, not row position', async () => {
    const s = setup();
    await s.service.updateContact(7, 1, 61, { phones: [{ raw: '1-2-3' }] });
    expect(s.phone.update).toHaveBeenCalledWith(expect.objectContaining({ normalized: '123' }), { transaction: s.transaction });
    expect(s.phones.destroy).not.toHaveBeenCalled();
  });
  it('rejects replacing a phone referenced by a task', async () => {
    const s = setup();
    s.tasks.count.mockResolvedValue(1);
    await expect(s.service.updateContact(7, 1, 61, { phones: [{ uid: 51, raw: '456' }] })).rejects.toMatchObject({ response: { code: 'AC_PHONE_IN_USE' } });
    expect(s.phone.update).not.toHaveBeenCalled();
    expect(s.phones.destroy).not.toHaveBeenCalled();
  });
  it('rejects foreign phone UIDs and deleting a contact with history', async () => {
    const s = setup();
    await expect(s.service.updateContact(7, 1, 61, { phones: [{ uid: 999, raw: '123' }] })).rejects.toMatchObject({ response: { code: 'AC_PHONE_UID' } });
    s.tasks.count.mockResolvedValue(1);
    await expect(s.service.deleteContact(7, 1, 61)).rejects.toMatchObject({ response: { code: 'AC_CONTACT_IN_USE' } });
    expect(s.contacts.destroy).not.toHaveBeenCalled();
  });
  it('bulk-deletes unused bases and reports referenced ones', async () => {
    const s = setup();
    jest.spyOn(s.service, 'remove')
      .mockResolvedValueOnce(undefined)
      .mockRejectedValueOnce({ response: { code: 'AC_BASE_IN_USE' } });
    await expect(s.service.removeMany(7, [1, 2, 2, -1])).resolves.toEqual({
      deleted: [1],
      failed: [{ uid: 2, code: 'AC_BASE_IN_USE' }],
    });
  });
});
