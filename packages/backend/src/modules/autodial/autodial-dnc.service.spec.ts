import { AutodialDncService } from './autodial-dnc.service';
import { Op } from 'sequelize';

describe('AutodialDncService', () => {
  it('stores a Russian phone in the dialer canonical form', async () => {
    const create = jest.fn().mockImplementation(async (value) => ({ uid: 1, ...value }));
    const service = new AutodialDncService(
      { create } as never,
      undefined as never,
      undefined as never,
    );

    await service.create(7, {
      scope: 'global',
      normalized_phone: '8 (999) 123-45-67',
    });

    expect(create).toHaveBeenCalledWith(
      expect.objectContaining({ normalized_phone: '79991234567' }),
    );
  });

  it('matches a legacy digit-only DNC row against the canonical dialed phone', async () => {
    const findOne = jest.fn().mockResolvedValue(null);
    const service = new AutodialDncService(
      { findOne } as never,
      undefined as never,
      undefined as never,
    );

    await service.isBlocked(7, '79991234567', { campaignUid: 11, baseUid: 8 });

    const query = findOne.mock.calls[0][0];
    expect(query.where.normalized_phone[Op.in]).toEqual(
      expect.arrayContaining(['79991234567', '89991234567']),
    );
  });

  it('rejects a base scope that does not belong to the current organization', async () => {
    const create = jest.fn();
    const findOne = jest.fn().mockResolvedValue(null);
    const service = new AutodialDncService(
      { create } as never,
      { findOne } as never,
      undefined as never,
    );

    await expect(
      service.create(7, {
        scope: 'base',
        scope_uid: 8,
        normalized_phone: '79991234567',
      }),
    ).rejects.toMatchObject({ response: { code: 'AC_DNC_SCOPE_NOT_FOUND' } });
    expect(create).not.toHaveBeenCalled();
    expect(findOne).toHaveBeenCalledWith({
      where: { uid: 8, user_uid: 7 },
      attributes: ['uid'],
    });
  });
});
