import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import * as path from 'path';

/**
 * AppConfigModule — centralised configuration module.
 *
 * Wraps @nestjs/config's ConfigModule.forRoot() with project-standard
 * settings so they don't have to be repeated across the app.
 * Import this module in AppModule instead of raw ConfigModule.forRoot().
 */
@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: path.resolve(__dirname, '../../../../.env'),
    }),
  ],
  exports: [ConfigModule],
})
export class AppConfigModule {}
