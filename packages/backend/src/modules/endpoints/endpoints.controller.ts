import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  Req,
  UseGuards,
} from '@nestjs/common';
import { Request } from 'express';
import { EndpointsService } from './endpoints.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CreateEndpointDto, BulkCreateEndpointDto } from './dto/create-endpoint.dto';

@UseGuards(JwtAuthGuard)
@Controller('endpoints')
export class EndpointsController {
  constructor(private readonly endpointsService: EndpointsService) {}

  @Get()
  findAll(@Req() req: Request & { user: any }) {
    return this.endpointsService.findAll(req.user.vpbx_user_uid);
  }

  @Post()
  create(@Body() dto: CreateEndpointDto, @Req() req: Request & { user: any }) {
    return this.endpointsService.create(dto, req.user.vpbx_user_uid, req.user.uid);
  }

  @Post('bulk')
  bulkCreate(@Body() dto: BulkCreateEndpointDto, @Req() req: Request & { user: any }) {
    return this.endpointsService.bulkCreate(dto, req.user.vpbx_user_uid, req.user.uid);
  }

  @Get('bulk/active')
  getActiveBulkJob(@Req() req: Request & { user: any }) {
    return this.endpointsService.getActiveBulkJob(req.user.vpbx_user_uid);
  }

  @Get('bulk/status/:jobId')
  getBulkJobStatus(@Param('jobId') jobId: string) {
    return this.endpointsService.getBulkJobStatus(jobId);
  }

  @Get(':sipId')
  findOne(@Param('sipId') sipId: string, @Req() req: Request & { user: any }) {
    return this.endpointsService.findOne(sipId, req.user.vpbx_user_uid);
  }

  @Get(':sipId/credentials')
  getCredentials(@Param('sipId') sipId: string, @Req() req: Request & { user: any }) {
    return this.endpointsService.getCredentials(sipId, req.user.vpbx_user_uid);
  }

  @Put(':sipId')
  update(@Param('sipId') sipId: string, @Body() body: any, @Req() req: Request & { user: any }) {
    return this.endpointsService.update(sipId, body, req.user.vpbx_user_uid, req.user.uid);
  }

  @Delete(':sipId')
  remove(@Param('sipId') sipId: string, @Req() req: Request & { user: any }) {
    return this.endpointsService.remove(sipId, req.user.vpbx_user_uid, req.user.uid);
  }
}
