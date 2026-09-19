import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import * as path from 'path';
import {
  createPbxRuntimeImports, PBX_CORE_MODELS, PBX_THROTTLER_PROVIDER,
} from './compositions/pbx-core.composition';
import {
  COMMERCIAL_AI_MODELS, COMMERCIAL_AI_NEST_MODULES,
} from './compositions/commercial-ai.composition';
import { assertProviderKeySecret } from './compositions/provider-key-secret';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: path.resolve(__dirname, '../../../.env'),
      ignoreEnvFile: process.env.CI === 'true' && process.env.DB_CORE_TEST_PROFILE === 'true',
    }),
    ...createPbxRuntimeImports(
      [...PBX_CORE_MODELS, ...COMMERCIAL_AI_MODELS],
      COMMERCIAL_AI_NEST_MODULES,
    ),
  ],
  providers: [PBX_THROTTLER_PROVIDER],
})
export class AppModule {
  constructor() {
    assertProviderKeySecret();
  }
}

export { PROVIDER_KEY_SECRET_VAR, assertProviderKeySecret } from './compositions/provider-key-secret';
