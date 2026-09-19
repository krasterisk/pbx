import { MODULE_METADATA } from '@nestjs/common/constants';
import { getModelToken } from '@nestjs/sequelize';
import { Test } from '@nestjs/testing';
import { AiConnectivityModule } from './ai-connectivity.module';
import { CcAiProvider } from './ai-provider.model';
import { AiProvidersService } from './ai-providers.service';

describe('AiConnectivityModule composition', () => {
  it('resolves the shared provider store without robot controllers or PBX listeners', async () => {
    const model = { findAll: jest.fn().mockResolvedValue([]) };
    const module = await Test.createTestingModule({ imports: [AiConnectivityModule] })
      .overrideProvider(getModelToken(CcAiProvider)).useValue(model).compile();
    expect(module.get(AiProvidersService)).toBeInstanceOf(AiProvidersService);
    expect(Reflect.getMetadata(MODULE_METADATA.CONTROLLERS, AiConnectivityModule) ?? []).toEqual([]);
    await expect(module.get(AiProvidersService).findAll(0)).resolves.toEqual([]);
    await module.close();
  });
});
