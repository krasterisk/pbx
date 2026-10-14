import { Controller, Get, Req, UseGuards } from '@nestjs/common';
import { InjectConnection } from '@nestjs/sequelize';
import { Sequelize } from 'sequelize-typescript';
import { QueryTypes } from 'sequelize';
import { StandaloneRobotGuard, robotTenant } from './access';
import type { StandaloneRobotRequest } from './access';

/** Read-only projections of existing v3 tables; no v4 ORM models attached. */
@Controller('public')
@UseGuards(StandaloneRobotGuard)
export class StandaloneCatalogsController {
  constructor(@InjectConnection() private readonly db: Sequelize) {}
  @Get('contexts') contexts(@Req() req: StandaloneRobotRequest) {
    return this.db.query('SELECT uid,name,comment FROM contexts WHERE user_uid=:tenant ORDER BY name', {
      replacements: { tenant: robotTenant(req) }, type: QueryTypes.SELECT,
    });
  }
  @Get('queues') queues(@Req() req: StandaloneRobotRequest) {
    return this.db.query('SELECT uid,name,exten AS extension,comment,active FROM queues WHERE user_uid=:tenant ORDER BY name', {
      replacements: { tenant: robotTenant(req) }, type: QueryTypes.SELECT,
    });
  }
  @Get('prompts') prompts(@Req() req: StandaloneRobotRequest) {
    return this.db.query('SELECT uid,filename,comment AS name,comment FROM prompts WHERE user_uid=:tenant ORDER BY filename', {
      replacements: { tenant: robotTenant(req) }, type: QueryTypes.SELECT,
    });
  }
}
