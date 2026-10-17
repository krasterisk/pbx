import { CallCenterCardsService } from './callcenter-cards.service';

describe('Generic card directory choices', () => {
  const source = { source: 'directory' as const, directoryUid: 9, valueFieldUid: 10, labelFieldUid: 11 };
  let fields: any; let directories: any; let service: CallCenterCardsService; let data: any;
  beforeEach(() => {
    fields = { findOne: jest.fn(async () => ({ options: source })), findAll: jest.fn(async () => [{ field_key: 'topic', field_type: 'select', options: source }]) };
    directories = { findOne: jest.fn(async () => ({ fields: [{ uid: 10, key: 'code' }, { uid: 11, key: 'caption' }, { uid: 12, key: 'private' }], records: [{ values: { code: 'a', caption: 'Консультация', private: 'hidden' } }] })) };
    data = { findOne: jest.fn(async () => null), create: jest.fn(async (v: any) => v) };
    service = new CallCenterCardsService({ findOne: jest.fn(async () => ({ uid: 1 })) } as any, fields, data, {} as any, {} as any, directories);
  });
  it('scopes directory and field reads to tenant and projects only the configured columns', async () => {
    expect(await service.fieldChoices(1, 'topic', 7)).toEqual([{ value: 'a', label: 'Консультация' }]);
    expect(directories.findOne).toHaveBeenCalledWith(9, 7);
    expect(fields.findOne).toHaveBeenCalledWith({ where: { template_id: 1, field_key: 'topic', user_uid: 7 } });
  });
  it('canonicalizes labels on save; a client cannot forge the directory caption', async () => {
    await service.saveCard({ template_id: 1, field_values: { topic: { value: 'a', label: 'forged' } } }, 7, 58);
    expect(data.create.mock.calls[0][0].field_values.topic).toEqual({ value: 'a', label: 'Консультация' });
    await expect(service.saveCard({ template_id: 1, field_values: { topic: 'foreign' } }, 7, 58)).rejects.toThrow('Unknown choice');
  });
  it('updates an existing same-call card and preserves historical labels when directory disappears', async () => {
    const old = { topic: { value: 'a', label: 'Old caption' } };
    const update = jest.fn(async (v: any) => v);
    data.findOne.mockResolvedValue({ field_values: old, update });
    directories.findOne.mockRejectedValue(new Error('not found'));
    await service.saveCard({ template_id: 1, call_uniqueid: 'test.1', field_values: old }, 7, 58);
    expect(update.mock.calls[0][0].field_values).toEqual(old);
    expect(data.create).not.toHaveBeenCalled();
    expect(directories.findOne).not.toHaveBeenCalled();
  });
  it('rejects nonunique codes, missing columns and foreign directories before a template write', async () => {
    directories.findOne.mockResolvedValue({ fields: [{ uid: 10, key: 'code' }, { uid: 11, key: 'caption' }], records: [{ values: { code: 'a', caption: 'A' } }, { values: { code: 'a', caption: 'B' } }] });
    await expect(service.directoryChoices(source, 7)).rejects.toThrow('unique');
    await expect(service.directoryChoices({ ...source, labelFieldUid: 99 }, 7)).rejects.toThrow('column');
    directories.findOne.mockRejectedValue(new Error('not found'));
    await expect(service.validateTemplateFields([{ field_key: 'topic', field_type: 'select', label: 'Тема', options: source }], 7)).rejects.toThrow('not found');
  });
});
