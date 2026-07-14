import { Global, Module } from '@nestjs/common';
import { AiAdapterRegistryService } from './ai-adapter-registry.service';

/**
 * AiPlatformModule — lightweight, domain-agnostic AI adapter registry (D-14).
 *
 * @Global(): once imported by any module in the app (currently PhonebooksModule,
 * McpModule, AiChatModule), AiAdapterRegistryService is injectable everywhere
 * without further imports. This module never imports domain modules — domains
 * depend on it, not the other way around, so there is no cycle risk.
 */
@Global()
@Module({
  providers: [AiAdapterRegistryService],
  exports: [AiAdapterRegistryService],
})
export class AiPlatformModule {}
