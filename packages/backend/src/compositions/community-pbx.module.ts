import { Controller, Get, Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import * as path from 'path';
import {
  createPbxRuntimeImports, PBX_CORE_MODELS, PBX_THROTTLER_PROVIDER,
} from './pbx-core.composition';
import { assertProviderKeySecret } from './provider-key-secret';

export const COMMUNITY_PBX_COMPONENTS = Object.freeze([
  'pbx-core', 'tenant-identity', 'ai-connectivity', 'integration-credentials',
]);

@Controller('composition')
class CommunityPbxCompositionController {
  @Get()
  describe() {
    return {
      status: 'ok',
      profile: 'community-pbx',
      commercialProductSource: 'absent',
      productRuntime: 'community-core',
    };
  }
}

/** Compile-time community PBX: existing core without commercial AI product modules. */
@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: path.resolve(__dirname, '../../../../.env'),
      ignoreEnvFile: process.env.CI === 'true' && process.env.DB_CORE_TEST_PROFILE === 'true',
    }),
    ...createPbxRuntimeImports(PBX_CORE_MODELS),
  ],
  controllers: [CommunityPbxCompositionController],
  providers: [PBX_THROTTLER_PROVIDER],
})
export class CommunityPbxModule {
  constructor() {
    assertProviderKeySecret();
  }
}
