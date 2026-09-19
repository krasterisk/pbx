import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { SequelizeModule } from '@nestjs/sequelize';
import { ThrottlerModule } from '@nestjs/throttler';
import { User } from '../users/user.model';
import { requireJwtSecret } from '../auth/jwt-secret';
import { IntegrationCredentialsModule } from '../integration-credentials/integration-credentials.module';
import { StandaloneLoginController } from './standalone-login.controller';
import { StandaloneLoginService } from './standalone-login.service';

@Module({
  imports: [
    SequelizeModule.forFeature([User]), IntegrationCredentialsModule,
    ThrottlerModule.forRoot([{ ttl: 60_000, limit: 20 }]),
    JwtModule.registerAsync({
      imports: [ConfigModule], inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        secret: requireJwtSecret(config),
        signOptions: { expiresIn: '2h', issuer: 'krasterisk-v4', audience: 'krasterisk-v4-client' },
      }),
    }),
  ],
  controllers: [StandaloneLoginController],
  providers: [StandaloneLoginService],
})
export class StandaloneIdentityModule {}
