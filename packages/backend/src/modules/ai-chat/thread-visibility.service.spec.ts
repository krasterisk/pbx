import { ThreadVisibilityService } from './thread-visibility.service';
import { UserLevel } from '../users/user.model';

const OWN_ONLY = { readableAuthors: null, allTenantThreads: false };

function row(data: Record<string, unknown>) {
  return {
    ...data,
    getDataValue: (key: string) => data[key],
  };
}

describe('ThreadVisibilityService', () => {
  const tenantA = 10;
  const tenantB = 20;
  const userUid = 100;

  let userModel: { findOne: jest.Mock; findByPk: jest.Mock };
  let numberListModel: { findOne: jest.Mock; findByPk: jest.Mock };
  let settings: { getSeeAllThreads: jest.Mock };
  let service: ThreadVisibilityService;

  beforeEach(() => {
    userModel = {
      findOne: jest.fn().mockResolvedValue(null),
      findByPk: jest.fn(async () => {
        throw new Error('findByPk is forbidden — every lookup must include tenant');
      }),
    };
    numberListModel = {
      findOne: jest.fn().mockResolvedValue(null),
      findByPk: jest.fn(async () => {
        throw new Error('findByPk is forbidden — every lookup must include tenant');
      }),
    };
    settings = { getSeeAllThreads: jest.fn().mockResolvedValue(false) };
    service = new ThreadVisibilityService(userModel as any, numberListModel as any, settings as any);
  });

  it('gives an operator only own threads when no access list is attached', async () => {
    userModel.findOne.mockResolvedValue(row({ uniqueid: userUid, vpbx_user_uid: tenantA, numbers_id: null }));

    await expect(service.resolve(tenantA, userUid, UserLevel.OPERATOR)).resolves.toEqual(OWN_ONLY);
    expect(userModel.findOne).toHaveBeenCalledWith({
      where: { uniqueid: userUid, vpbx_user_uid: tenantA },
      attributes: ['uniqueid', 'numbers_id'],
    });
    expect(numberListModel.findOne).not.toHaveBeenCalled();
    expect(userModel.findByPk).not.toHaveBeenCalled();
    expect(numberListModel.findByPk).not.toHaveBeenCalled();
  });

  it('reads foreign authors from the access list blob', async () => {
    userModel.findOne.mockResolvedValue(row({ uniqueid: userUid, vpbx_user_uid: tenantA, numbers_id: 5 }));
    numberListModel.findOne.mockResolvedValue(
      row({ id: 5, user_uid: tenantA, numbers: { aiThreads: { userIds: [11, 12] } } }),
    );

    await expect(service.resolve(tenantA, userUid, UserLevel.OPERATOR)).resolves.toEqual({
      readableAuthors: [11, 12],
      allTenantThreads: false,
    });
    expect(numberListModel.findOne).toHaveBeenCalledWith({
      where: { id: 5, user_uid: tenantA },
      attributes: ['id', 'numbers', 'user_uid'],
    });
  });

  it('treats an empty access list as no foreign threads', async () => {
    userModel.findOne.mockResolvedValue(row({ uniqueid: userUid, vpbx_user_uid: tenantA, numbers_id: 5 }));
    numberListModel.findOne.mockResolvedValue(
      row({ id: 5, user_uid: tenantA, numbers: { aiThreads: { userIds: [] } } }),
    );

    await expect(service.resolve(tenantA, userUid, UserLevel.OPERATOR)).resolves.toEqual(OWN_ONLY);
  });

  it('ignores the access list of another tenant', async () => {
    userModel.findOne.mockResolvedValue(row({ uniqueid: userUid, vpbx_user_uid: tenantA, numbers_id: 5 }));
    numberListModel.findOne.mockImplementation(async ({ where }: { where: { id: number; user_uid: number } }) => {
      if (where.user_uid !== tenantA) {
        return row({ id: 5, user_uid: tenantB, numbers: { aiThreads: { userIds: [11] } } });
      }
      return null;
    });

    await expect(service.resolve(tenantA, userUid, UserLevel.OPERATOR)).resolves.toEqual(OWN_ONLY);
    expect(numberListModel.findOne).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: 5, user_uid: tenantA } }),
    );
  });

  it('drops the caller from the readable list', async () => {
    userModel.findOne.mockResolvedValue(row({ uniqueid: userUid, vpbx_user_uid: tenantA, numbers_id: 5 }));
    numberListModel.findOne.mockResolvedValue(
      row({ id: 5, user_uid: tenantA, numbers: { aiThreads: { userIds: [userUid, 11, 12] } } }),
    );

    const scope = await service.resolve(tenantA, userUid, UserLevel.OPERATOR);
    expect(scope.readableAuthors).toEqual([11, 12]);
    expect(scope.readableAuthors).not.toContain(userUid);
    expect(scope.allTenantThreads).toBe(false);
  });

  it('gives a tenant admin all threads only when the tenant flag is on', async () => {
    settings.getSeeAllThreads.mockResolvedValueOnce(false);
    await expect(service.resolve(tenantA, userUid, UserLevel.ADMIN)).resolves.toEqual(OWN_ONLY);

    userModel.findOne.mockClear();
    settings.getSeeAllThreads.mockResolvedValueOnce(true);
    await expect(service.resolve(tenantA, userUid, UserLevel.ADMIN)).resolves.toEqual({
      readableAuthors: null,
      allTenantThreads: true,
    });
    expect(userModel.findOne).not.toHaveBeenCalled();
  });

  it('does not give the flag to a supervisor', async () => {
    settings.getSeeAllThreads.mockResolvedValue(true);
    userModel.findOne.mockResolvedValue(row({ uniqueid: userUid, vpbx_user_uid: tenantA, numbers_id: null }));

    await expect(service.resolve(tenantA, userUid, UserLevel.SUPERVISOR)).resolves.toEqual(OWN_ONLY);
    expect(settings.getSeeAllThreads).not.toHaveBeenCalled();
  });
});
