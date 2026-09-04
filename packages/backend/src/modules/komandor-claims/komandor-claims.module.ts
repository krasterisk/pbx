import { Module } from '@nestjs/common';
import { SequelizeModule } from '@nestjs/sequelize';
import { ConfigModule } from '@nestjs/config';
import { KomandorClaim } from './komandor-claim.model';
import { KomandorStore } from './komandor-store.model';
import { KomandorDict } from './komandor-dict.model';
import { KomandorClaimsService } from './komandor-claims.service';
import { KomandorClaimsController } from './komandor-claims.controller';
import { KomandorClaimsPublicController } from './komandor-claims-public.controller';
import { SmsModule } from '../sms/sms.module';
import { MailerModule } from '../mailer/mailer.module';
import { CloudAdminModule } from '../cloud-admin/cloud-admin.module';
import { AiPlatformModule } from '../ai-platform/ai-platform.module';
import { KomandorClaimsAiAdapter } from './komandor-claims-ai.adapter';

@Module({
  imports: [
    ConfigModule,
    SequelizeModule.forFeature([KomandorClaim, KomandorStore, KomandorDict]),
    SmsModule,
    MailerModule,
    CloudAdminModule,
    AiPlatformModule,
  ],
  controllers: [KomandorClaimsController, KomandorClaimsPublicController],
  providers: [KomandorClaimsService, KomandorClaimsAiAdapter],
  exports: [KomandorClaimsService],
})
export class KomandorClaimsModule {}
