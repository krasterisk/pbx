import { BadRequestException, ForbiddenException } from '@nestjs/common';
import { validate } from 'class-validator';
import { SystemSettingsService } from './system-settings.service';
import { OrganizationWeekStartDto } from './organization-week-start.dto';
import { SystemSettingsController } from './system-settings.controller';
import { ROLES_KEY } from '../auth/roles.decorator';
import { readOrganizationWeekStart } from '../../shared/organization-calendar';
import type { JwtPayloadUser } from '../auth/auth.service';

describe('organization calendar week start', () => {
  const user = { sub: 7, level: 1, vpbx_user_uid: 42 } as JwtPayloadUser;
  function fixture() {
    const query = jest.fn().mockResolvedValue([]), upsert = jest.fn(), tx = {};
    const transaction = jest.fn(async work => work(tx)), audit = { create: jest.fn() };
    const db = { query, transaction, getDialect: () => 'mysql' };
    const service = new SystemSettingsService({ sequelize: db, upsert } as never, {} as never, audit as never);
    return { service, db, query, upsert, tx, audit };
  }
  it('defaults to Monday and binds the authenticated tenant key, including box tenant0', async () => {
    const f = fixture();
    await expect(f.service.organizationCalendar(user)).resolves.toEqual({weekStart:'monday',canEdit:true});
    expect(f.query).toHaveBeenLastCalledWith(expect.any(String),expect.objectContaining({replacements:{calendarKey:'organization.weekStart.42'}}));
    await f.service.organizationCalendar({...user,vpbx_user_uid:0});
    expect(f.query).toHaveBeenLastCalledWith(expect.any(String),expect.objectContaining({replacements:{calendarKey:'organization.weekStart.0'}}));
  });
  it('allows ordinary users to read policy but rejects non-admin writes before SQL', async () => {
    const f=fixture(); f.query.mockResolvedValue([{value:'sunday'}]);
    await expect(f.service.organizationCalendar({...user,level:2})).resolves.toEqual({weekStart:'sunday',canEdit:false});
    f.query.mockClear();
    await expect(f.service.setOrganizationWeekStart({...user,level:2},'sunday')).rejects.toThrow(ForbiddenException);
    expect(f.query).not.toHaveBeenCalled();expect(f.upsert).not.toHaveBeenCalled();
    expect(Reflect.getMetadata(ROLES_KEY,SystemSettingsController.prototype.organizationCalendar)).toEqual([]);
    expect(Reflect.getMetadata(ROLES_KEY,SystemSettingsController)).toEqual([1]);
    expect(Reflect.getMetadata(ROLES_KEY,SystemSettingsController.prototype.setOrganizationWeekStart)).toBeUndefined();
  });
  it('validates values and writes policy and audit in the same tenant transaction', async () => {
    const f=fixture();
    for(const value of ['tuesday',0,null,undefined]) {
      expect((await validate(Object.assign(new OrganizationWeekStartDto(),{weekStart:value}))).length).toBeGreaterThan(0);
      await expect(f.service.setOrganizationWeekStart(user,value as never)).rejects.toThrow(BadRequestException);
    }
    expect(f.upsert).not.toHaveBeenCalled();
    await expect(f.service.setOrganizationWeekStart(user,'sunday')).resolves.toEqual({weekStart:'sunday',canEdit:true});
    expect(f.upsert).toHaveBeenCalledWith(expect.objectContaining({key:'organization.weekStart.42',value:'sunday'}),{transaction:f.tx});
    expect(f.audit.create).toHaveBeenCalledWith(expect.objectContaining({user_uid:42,user_id:7,action:'organization_week_start_update'}),{transaction:f.tx});
  });
  it('rejects invalid tenant and surfaces DB errors instead of silently defaulting', async () => {
    const f=fixture();
    await expect(f.service.organizationCalendar({...user,vpbx_user_uid:-1})).rejects.toThrow(ForbiddenException);
    expect(f.query).not.toHaveBeenCalled();
    f.query.mockRejectedValue(new Error('offline'));
    await expect(readOrganizationWeekStart(f.db as never,42)).rejects.toThrow('offline');
    f.query.mockRejectedValue({original:{code:'ER_NO_SUCH_TABLE'}});
    await expect(readOrganizationWeekStart(f.db as never,42)).resolves.toBe('monday');
  });
});
