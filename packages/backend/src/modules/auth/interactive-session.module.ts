import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { InteractiveSessionService } from './interactive-session.service';

@Module({ imports: [ConfigModule], providers: [InteractiveSessionService], exports: [InteractiveSessionService] })
export class InteractiveSessionModule {}
