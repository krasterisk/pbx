import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { SequelizeModule } from '@nestjs/sequelize';
import { ThrottlerModule } from '@nestjs/throttler';
import { AuthService } from './auth.service';
import { AuthController } from './auth.controller';
import { JwtStrategy } from './jwt.strategy';
import { JwtAuthGuard } from './jwt-auth.guard';
import { RolesGuard } from './roles.guard';
import { SuperAdminGuard } from './superadmin.guard';
import { UserSession } from './user-session.model';
import { UsersModule } from '../users/users.module';
import { LoggerModule } from '../logger/logger.module';
import { MailerModule } from '../mailer/mailer.module';
import { requireJwtSecret } from './jwt-secret';
import { TenantRegistrationService } from './tenant-registration.service';
import { User } from '../users/user.model';
import { Tenant } from '../cloud-admin/tenant.model';
import { Context } from '../contexts/context.model';

@Module({
  imports: [
    SequelizeModule.forFeature([UserSession, User, Tenant, Context]),
    UsersModule,
    LoggerModule,
    MailerModule,
    // Rate limiting — shared store (in-memory by default, swap to Redis in production)
    ThrottlerModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: (config: ConfigService) => ([{
        ttl:   config.get<number>('THROTTLE_TTL', 60_000),
        limit: config.get<number>('THROTTLE_LIMIT', 20),
      }]),
      inject: [ConfigService],
    }),
    JwtModule.registerAsync({
      imports: [ConfigModule],
      useFactory: (config: ConfigService) => ({
        secret: requireJwtSecret(config),
        signOptions: {
          expiresIn: config.get('JWT_EXPIRES_IN', '2h') as any,
          issuer: 'krasterisk-v4',
          audience: 'krasterisk-v4-client',
        },
      }),
      inject: [ConfigService],
    }),
  ],
  controllers: [AuthController],
  providers: [AuthService, TenantRegistrationService, JwtStrategy, JwtAuthGuard, RolesGuard, SuperAdminGuard],
  exports: [AuthService, JwtAuthGuard, RolesGuard, SuperAdminGuard],
})
export class AuthModule {}
