import { BadRequestException, NotFoundException } from '@nestjs/common';
import { DirectoriesController } from './directories.controller';

describe('DirectoriesController', () => {
  let service: {
    findAll: jest.Mock;
    findOne: jest.Mock;
    create: jest.Mock;
    update: jest.Mock;
    remove: jest.Mock;
    importCsv: jest.Mock;
    exportCsv: jest.Mock;
    lookup: jest.Mock;
  };
  let controller: DirectoriesController;
  const req = { user: { vpbx_user_uid: 100 } };

  beforeEach(() => {
    service = {
      findAll: jest.fn().mockResolvedValue([]),
      findOne: jest.fn().mockResolvedValue({ uid: 7, user_uid: 100, fields: [] }),
      create: jest.fn().mockResolvedValue({ uid: 7 }),
      update: jest.fn().mockResolvedValue({ uid: 7 }),
      remove: jest.fn().mockResolvedValue(undefined),
      importCsv: jest.fn().mockResolvedValue({ imported: 1, replaced: 0, errors: [] }),
      exportCsv: jest.fn().mockResolvedValue('\ufeffphone;name;comment\r\n'),
      lookup: jest.fn().mockResolvedValue({
        status: 'FOUND',
        matchKind: 'exact',
        values: ['700', 'Alice'],
      }),
    };
    controller = new DirectoriesController(service as any);
  });

  it('always passes req.user.vpbx_user_uid to management CRUD', async () => {
    const body = { name: 'Customers', user_uid: 999 };

    await controller.findAll(req);
    expect(service.findAll).toHaveBeenCalledWith(100);

    await controller.findOne(7, req);
    expect(service.findOne).toHaveBeenCalledWith(7, 100);

    await controller.create(body, req);
    expect(service.create).toHaveBeenCalledWith(body, 100);

    await controller.update(7, body, req);
    expect(service.update).toHaveBeenCalledWith(7, body, 100);

    await controller.remove(7, req);
    expect(service.remove).toHaveBeenCalledWith(7, 100);
  });

  it('does not re-apply dialplan when a directory is updated', async () => {
    await controller.update(7, { name: 'Renamed' }, req);
    expect(service.update).toHaveBeenCalledTimes(1);
    expect(Object.keys(controller as any)).not.toEqual(expect.arrayContaining(['routeApplyService']));
  });

  it('lookup-test returns structured status, match kind, and field values', async () => {
    const result = await controller.lookupTest(
      7,
      { key: '100', fieldUids: [17, 18] },
      req,
    );

    expect(service.findOne).toHaveBeenCalledWith(7, 100);
    expect(service.lookup).toHaveBeenCalledWith({
      directoryUid: 7,
      userUid: 100,
      key: '100',
      fieldUids: [17, 18],
    });
    expect(result).toEqual({
      status: 'FOUND',
      matchKind: 'exact',
      values: ['700', 'Alice'],
    });
  });

  it('lookup-test does not call lookup for a foreign tenant directory', async () => {
    service.findOne.mockRejectedValue(new NotFoundException('Directory not found'));

    await expect(
      controller.lookupTest(7, { key: '100', fieldUids: [17] }, req),
    ).rejects.toThrow(NotFoundException);
    expect(service.lookup).not.toHaveBeenCalled();
  });

  it('CSV import/export uses declared field keys and rejects unknown columns', async () => {
    service.importCsv.mockImplementation(async (_uid: number, csv: string) => {
      if (csv.includes('unknown_col')) {
        throw new BadRequestException({
          message: 'Unknown CSV column "unknown_col"',
          code: 'csv_invalid',
          errors: [
            {
              row: 1,
              column: 'unknown_col',
              code: 'unknown_column',
              message: 'Unknown CSV column "unknown_col"',
            },
          ],
        });
      }
      return { imported: 1, replaced: 3, errors: [] };
    });

    await expect(
      controller.importCsv(7, { csv: 'phone;name;comment\n100;Alice;\n' }, req),
    ).resolves.toEqual({ imported: 1, replaced: 3, errors: [] });
    expect(service.importCsv).toHaveBeenCalledWith(
      7,
      'phone;name;comment\n100;Alice;\n',
      100,
    );

    await expect(
      controller.importCsv(7, { csv: 'unknown_col;match_kind;priority\n' }, req),
    ).rejects.toBeInstanceOf(BadRequestException);

    const res = { setHeader: jest.fn(), send: jest.fn() };
    await controller.exportCsv(7, req, res as any);
    expect(service.exportCsv).toHaveBeenCalledWith(7, 100);
    expect(res.setHeader).toHaveBeenCalledWith('Content-Type', 'text/csv; charset=utf-8');
    expect(res.send).toHaveBeenCalledWith('\ufeffphone;name;comment\r\n');
  });

  it('surfaces row-addressed CSV errors to the caller', async () => {
    service.importCsv.mockRejectedValue(
      new BadRequestException({
        message: 'Duplicate lookup value "_7900XXXXXXX"',
        code: 'csv_invalid',
        errors: [
          { row: 3, column: 'phone', code: 'duplicate_key', message: 'Duplicate lookup value "_7900XXXXXXX"' },
        ],
      }),
    );

    await expect(
      controller.importCsv(7, { csv: 'phone\n_7900XXXXXXX\n_7900XXXXXXX\n' }, req),
    ).rejects.toMatchObject({
      response: {
        code: 'csv_invalid',
        errors: [expect.objectContaining({ row: 3, code: 'duplicate_key' })],
      },
    });
  });
});
