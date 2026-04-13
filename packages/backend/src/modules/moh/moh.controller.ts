import {
  Controller, Get, Post, Put, Delete,
  Param, Body, Req,
} from '@nestjs/common';
import { MohService } from './moh.service';

@Controller('moh')
export class MohController {
  constructor(private readonly mohService: MohService) {}

  @Get()
  async findAll(@Req() req: any) {
    const userUid = req.user?.vpbx_user_uid || req.user?.user_uid || 0;
    return this.mohService.findAll(userUid);
  }

  @Get(':name')
  async findOne(@Param('name') name: string, @Req() req: any) {
    const userUid = req.user?.vpbx_user_uid || req.user?.user_uid || 0;
    return this.mohService.findOne(name, userUid);
  }

  @Post()
  async create(
    @Body() body: {
      displayName: string;
      sort?: string;
      entries?: { filename: string; position: number }[];
    },
    @Req() req: any,
  ) {
    const userUid = req.user?.vpbx_user_uid || req.user?.user_uid || 0;
    return this.mohService.create(body, userUid);
  }

  @Put(':name')
  async update(
    @Param('name') name: string,
    @Body() body: {
      displayName?: string;
      sort?: string;
      entries?: { filename: string; position: number }[];
    },
    @Req() req: any,
  ) {
    const userUid = req.user?.vpbx_user_uid || req.user?.user_uid || 0;
    return this.mohService.update(name, body, userUid);
  }

  @Delete(':name')
  async remove(@Param('name') name: string, @Req() req: any) {
    const userUid = req.user?.vpbx_user_uid || req.user?.user_uid || 0;
    await this.mohService.remove(name, userUid);
    return { message: 'MOH class deleted', name };
  }
}
