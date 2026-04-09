import { Controller, Get, Post, Put, Delete, Param, Body, Query, UseGuards, ParseIntPipe } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { PeersService } from './peers.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

@ApiTags('Peers')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('peers')
export class PeersController {
  constructor(private readonly peersService: PeersService) {}

  @Get()
  findAll(@Query('userUid') userUid?: string) {
    return this.peersService.findAll(userUid ? Number(userUid) : undefined);
  }

  @Get(':uid')
  findById(@Param('uid', ParseIntPipe) uid: number) {
    return this.peersService.findById(uid);
  }

  @Post()
  create(@Body() data: any) {
    return this.peersService.create(data);
  }

  @Put(':uid')
  update(@Param('uid', ParseIntPipe) uid: number, @Body() data: any) {
    return this.peersService.update(uid, data);
  }

  @Delete(':uid')
  delete(@Param('uid', ParseIntPipe) uid: number) {
    return this.peersService.delete(uid);
  }
}
