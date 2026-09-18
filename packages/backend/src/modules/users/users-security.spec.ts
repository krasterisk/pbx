import { UsersController } from './users.controller';
import { UsersService } from './users.service';

describe('User tenant and role boundaries', () => {
  const audit = { logAction: jest.fn().mockResolvedValue(undefined) };
  it('does not drop the tenant predicate when the tenant is zero', async () => {
    const model = { findOne: jest.fn().mockResolvedValue(null) };
    await new UsersService(model as any, {} as any).findById(99, 0);
    expect(model.findOne).toHaveBeenCalledWith(expect.objectContaining({ where: { uniqueid: 99, vpbx_user_uid: 0 } }));
  });
  it('refuses non-admin account creation and deletion', async () => {
    const service = { create: jest.fn(), delete: jest.fn() };
    const controller = new UsersController(service as any, audit as any);
    const req = { user: { sub: 9, level: 2, vpbx_user_uid: 7 } };
    await expect(controller.create({ login: 'x', level: 1 }, req)).rejects.toThrow('Administrator required');
    await expect(controller.delete(10, req)).rejects.toThrow('Administrator required');
    expect(service.create).not.toHaveBeenCalled();
  });
  it('blocks platform role assignment and strips tenant/activation injection', async () => {
    const service = { update: jest.fn().mockResolvedValue({}) };
    const controller = new UsersController(service as any, audit as any);
    const admin = { user: { sub: 9, level: 1, vpbx_user_uid: 7 } };
    await expect(controller.update(9, { level: 0 }, admin)).rejects.toThrow('Platform administrator');
    await controller.update(9, { name: 'safe', vpbx_user_uid: 88, isActivated: true }, admin);
    expect(service.update).toHaveBeenCalledWith(9, 7, { name: 'safe' });
  });
});
