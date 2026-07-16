import {
  BadRequestException,
  HttpException,
  HttpStatus,
  NotFoundException,
} from '@nestjs/common';
import { PurchaseModuleService } from './purchase-module.service';

/**
 * NAV-07 / D-23 — charge-then-activate purchase contract (plan 08-06).
 *
 * Never trust a client "paid" flag or client-supplied amount.
 */
describe('PurchaseModuleService', () => {
  let service: PurchaseModuleService;
  let billing: { getBalance: jest.Mock; charge: jest.Mock; deposit: jest.Mock };
  let modules: {
    resolvePurchaseOffer: jest.Mock;
    isModuleActiveForTenant: jest.Mock;
    activateModule: jest.Mock;
  };
  beforeEach(() => {
    billing = {
      getBalance: jest.fn(),
      charge: jest.fn(),
      deposit: jest.fn(),
    };
    modules = {
      resolvePurchaseOffer: jest.fn(),
      isModuleActiveForTenant: jest.fn(),
      activateModule: jest.fn(),
    };
    service = new PurchaseModuleService(billing as any, modules as any);
    if ((service as any).logger?.error) {
      jest.spyOn((service as any).logger, 'error').mockImplementation();
    }
  });

  it('exposes purchase(tenantId, moduleCode, actorUserId)', () => {
    expect(typeof service.purchase).toBe('function');
  });

  it('throws when tenant balance is insufficient — never calls activateModule', async () => {
    modules.resolvePurchaseOffer.mockResolvedValue({
      code: 'voice_robot',
      name: 'Голосовые роботы',
      priceRub: 2500,
    });
    modules.isModuleActiveForTenant.mockResolvedValue(false);
    billing.getBalance.mockResolvedValue({
      balance_kopecks: 100_00,
      credit_limit_kopecks: 0,
    });

    await expect(service.purchase(1, 'voice_robot', 42)).rejects.toMatchObject({
      status: HttpStatus.PAYMENT_REQUIRED,
      response: expect.objectContaining({ code: 'INSUFFICIENT_BALANCE' }),
    });

    expect(billing.charge).not.toHaveBeenCalled();
    expect(modules.activateModule).not.toHaveBeenCalled();
  });

  it('on success calls charge then activateModule in that order', async () => {
    const order: string[] = [];
    modules.resolvePurchaseOffer.mockResolvedValue({
      code: 'voice_robot',
      name: 'Голосовые роботы',
      priceRub: 2500,
    });
    modules.isModuleActiveForTenant.mockResolvedValue(false);
    billing.getBalance.mockResolvedValue({
      balance_kopecks: 5000_00,
      credit_limit_kopecks: 0,
    });
    billing.charge.mockImplementation(async () => {
      order.push('charge');
      return { balance: {}, transaction: {} };
    });
    modules.activateModule.mockImplementation(async () => {
      order.push('activateModule');
      return { module_code: 'voice_robot', status: 'active' };
    });

    const result = await service.purchase(1, 'voice_robot', 42);

    expect(billing.charge).toHaveBeenCalledWith(
      1,
      2500,
      42,
      expect.stringContaining('voice_robot'),
      'voice_robot',
    );
    expect(modules.activateModule).toHaveBeenCalledWith(1, 'voice_robot');
    expect(order).toEqual(['charge', 'activateModule']);
    expect(result).toMatchObject({
      moduleCode: 'voice_robot',
      amountRub: 2500,
    });
  });

  it('rejects when module is already active', async () => {
    modules.resolvePurchaseOffer.mockResolvedValue({
      code: 'voice_robot',
      name: 'Голосовые роботы',
      priceRub: 2500,
    });
    modules.isModuleActiveForTenant.mockResolvedValue(true);

    await expect(service.purchase(1, 'voice_robot', 42)).rejects.toBeInstanceOf(
      BadRequestException,
    );
    expect(billing.charge).not.toHaveBeenCalled();
    expect(modules.activateModule).not.toHaveBeenCalled();
  });

  it('skips charge when price is zero and still activates', async () => {
    modules.resolvePurchaseOffer.mockResolvedValue({
      code: 'queues',
      name: 'Очереди',
      priceRub: 0,
    });
    modules.isModuleActiveForTenant.mockResolvedValue(false);
    modules.activateModule.mockResolvedValue({ module_code: 'queues', status: 'active' });

    await service.purchase(1, 'queues', 42);

    expect(billing.charge).not.toHaveBeenCalled();
    expect(modules.activateModule).toHaveBeenCalledWith(1, 'queues');
  });

  it('compensates charge when activateModule fails', async () => {
    modules.resolvePurchaseOffer.mockResolvedValue({
      code: 'voice_robot',
      name: 'Голосовые роботы',
      priceRub: 2500,
    });
    modules.isModuleActiveForTenant.mockResolvedValue(false);
    billing.getBalance.mockResolvedValue({
      balance_kopecks: 5000_00,
      credit_limit_kopecks: 0,
    });
    billing.charge.mockResolvedValue({ balance: {}, transaction: {} });
    modules.activateModule.mockRejectedValue(new Error('activate failed'));
    billing.deposit.mockResolvedValue({ balance: {}, transaction: {} });

    await expect(service.purchase(1, 'voice_robot', 42)).rejects.toThrow('activate failed');
    expect(billing.deposit).toHaveBeenCalledWith(
      1,
      2500,
      42,
      expect.stringContaining('compensate'),
    );
  });

  it('propagates NotFound when offer missing', async () => {
    modules.resolvePurchaseOffer.mockRejectedValue(
      new NotFoundException('Unknown module: nope'),
    );

    await expect(service.purchase(1, 'nope', 42)).rejects.toBeInstanceOf(NotFoundException);
  });

  it('HttpException for insufficient balance uses 402', async () => {
    modules.resolvePurchaseOffer.mockResolvedValue({
      code: 'voice_robot',
      name: 'X',
      priceRub: 100,
    });
    modules.isModuleActiveForTenant.mockResolvedValue(false);
    billing.getBalance.mockResolvedValue({
      balance_kopecks: 0,
      credit_limit_kopecks: 0,
    });

    try {
      await service.purchase(1, 'voice_robot', 42);
      fail('expected throw');
    } catch (e) {
      expect(e).toBeInstanceOf(HttpException);
      expect((e as HttpException).getStatus()).toBe(402);
    }
  });
});
