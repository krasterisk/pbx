import { type INestApplication, ValidationPipe, type ExecutionContext } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { AutodialBasesController } from './autodial-bases.controller';
import { AutodialBasesService } from './autodial-bases.service';
import { AutodialImportService } from './autodial-import.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { ModuleAccessGuard } from '../cloud-admin/module-access.guard';

describe('Autodial bases HTTP contract', () => {
  let app: INestApplication;
  let url: string;
  const service = {
    listContacts: jest.fn().mockResolvedValue({ items: [{ uid: 61 }], total: 61, page: 3, page_size: 25 }),
    findContact: jest.fn().mockResolvedValue({ uid: 61, base_uid: 1, values: { name: 'Alice' }, phones: [] }),
    updateContact: jest.fn().mockResolvedValue({ uid: 61 }),
  };
  beforeAll(async () => {
    const module = await Test.createTestingModule({
      controllers: [AutodialBasesController],
      providers: [
        { provide: AutodialBasesService, useValue: service },
        { provide: AutodialImportService, useValue: {} },
      ],
    }).overrideGuard(JwtAuthGuard).useValue({
      canActivate(context: ExecutionContext) {
        context.switchToHttp().getRequest().user = { vpbx_user_uid: 71 };
        return true;
      },
    }).overrideGuard(ModuleAccessGuard).useValue({ canActivate: () => true }).compile();
    app = module.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({ transform: true, whitelist: true }));
    await app.listen(0, '127.0.0.1');
    url = await app.getUrl();
  });
  afterAll(async () => { await app?.close(); });
  it('returns items and pagination over HTTP', async () => {
    const response = await fetch(url + '/autodial/bases/1/contacts?page=3&page_size=25');
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ items: [{ uid: 61 }], total: 61, page: 3, page_size: 25 });
    expect(service.listContacts).toHaveBeenCalledWith(71, 1, { page: 3, pageSize: 25, q: undefined });
  });
  it('routes detail requests to the exact scoped contact', async () => {
    const response = await fetch(url + '/autodial/bases/1/contacts/61');
    expect(response.status).toBe(200);
    expect(service.findContact).toHaveBeenCalledWith(71, 1, 61);
  });
  it('retains values and phone UID through the whitelist, strips tenant spoofing', async () => {
    const response = await fetch(url + '/autodial/bases/1/contacts/61', {
      method: 'PUT', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ user_uid: 72, values: { name: 'Alice' }, phones: [{ uid: 51, raw: '123' }], external_id: null, comment: '' }),
    });
    expect(response.status).toBe(200);
    expect(service.updateContact).toHaveBeenLastCalledWith(71, 1, 61, {
      values: { name: 'Alice' }, phones: [{ uid: 51, raw: '123' }], external_id: null, comment: '',
    });
  });
  it('rejects array values and invalid phone identities', async () => {
    const response = await fetch(url + '/autodial/bases/1/contacts/61', {
      method: 'PUT', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ values: [], phones: [{ uid: -1, raw: '123' }] }),
    });
    expect(response.status).toBe(400);
  });
});
