import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Param,
  Body,
  UseGuards,
  ParseIntPipe,
  Req,
  Res,
  UploadedFile,
  UseInterceptors,
  StreamableFile,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiBearerAuth, ApiTags, ApiConsumes, ApiBody } from '@nestjs/swagger';
import { createReadStream } from 'fs';
import type { Response } from 'express';
import { UsersService } from './users.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { LoggerService } from '../logger/logger.service';

@ApiTags('Users')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('users')
export class UsersController {
  constructor(
    private readonly usersService: UsersService,
    private readonly loggerService: LoggerService,
  ) {}

  @Get()
  findAll(@Req() req: any) {
    return this.usersService.findAll(req.user.vpbx_user_uid);
  }

  @Get(':id/avatar')
  async streamAvatar(
    @Param('id', ParseIntPipe) id: number,
    @Req() req: any,
    @Res({ passthrough: true }) res: Response,
  ) {
    const { absolutePath, contentType } = await this.usersService.openAvatarStream(
      id,
      req.user.vpbx_user_uid,
    );
    res.setHeader('Content-Type', contentType);
    res.setHeader('Cache-Control', 'private, max-age=86400');
    res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');
    return new StreamableFile(createReadStream(absolutePath));
  }

  @Post(':id/avatar')
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: { file: { type: 'string', format: 'binary' } },
    },
  })
  @UseInterceptors(FileInterceptor('file', {
    limits: { fileSize: 2 * 1024 * 1024 },
    fileFilter: (_req, file, cb) => {
      if (!file.mimetype.startsWith('image/')) {
        cb(new BadRequestException('Only image files are allowed'), false);
      } else {
        cb(null, true);
      }
    },
  }))
  async uploadAvatar(
    @Param('id', ParseIntPipe) id: number,
    @UploadedFile() file: Express.Multer.File,
    @Req() req: any,
  ) {
    if (!file) {
      throw new BadRequestException('No image file provided');
    }
    this.usersService.assertCanManageAvatar(
      { sub: req.user.sub, level: req.user.level },
      id,
    );
    const user = await this.usersService.saveAvatar(id, req.user.vpbx_user_uid, file);
    await this.loggerService.logAction(
      req.user.sub, 'update', 'user', id, req.user.vpbx_user_uid, 'avatar upload',
    );
    return user;
  }

  @Delete(':id/avatar')
  async deleteAvatar(@Param('id', ParseIntPipe) id: number, @Req() req: any) {
    this.usersService.assertCanManageAvatar(
      { sub: req.user.sub, level: req.user.level },
      id,
    );
    const user = await this.usersService.removeAvatar(id, req.user.vpbx_user_uid);
    await this.loggerService.logAction(
      req.user.sub, 'update', 'user', id, req.user.vpbx_user_uid, 'avatar remove',
    );
    return user;
  }

  @Get(':id')
  findById(@Param('id', ParseIntPipe) id: number, @Req() req: any) {
    return this.usersService.findById(id, req.user.vpbx_user_uid);
  }

  @Post()
  async create(@Body() data: any, @Req() req: any) {
    data.vpbx_user_uid = req.user.vpbx_user_uid;
    const user = await this.usersService.create(data);
    await this.loggerService.logAction(req.user.sub, 'create', 'user', user.uniqueid, req.user.vpbx_user_uid);
    return user;
  }

  @Put(':id')
  async update(@Param('id', ParseIntPipe) id: number, @Body() data: any, @Req() req: any) {
    const isAdmin =
      req.user.level === 0 || req.user.level === 1; // SUPERADMIN | ADMIN
    if (!isAdmin && req.user.sub !== id) {
      throw new ForbiddenException('Cannot update another user');
    }
    // Non-admins cannot change role/level/numbers via profile
    if (!isAdmin) {
      delete data.level;
      delete data.role;
      delete data.numbers_id;
      delete data.permit_extens;
    }
    const user = await this.usersService.update(id, req.user.vpbx_user_uid, data);
    await this.loggerService.logAction(req.user.sub, 'update', 'user', id, req.user.vpbx_user_uid);
    return user;
  }

  @Delete(':id')
  async delete(@Param('id', ParseIntPipe) id: number, @Req() req: any) {
    await this.usersService.delete(id, req.user.vpbx_user_uid);
    await this.loggerService.logAction(req.user.sub, 'delete', 'user', id, req.user.vpbx_user_uid);
  }

  @Post('bulk/delete')
  async bulkDelete(@Body() body: { ids: number[] }, @Req() req: any) {
    const result = await this.usersService.bulkRemove(body.ids, req.user.vpbx_user_uid);
    await this.loggerService.logAction(req.user.sub, 'bulk_delete', 'user', null, req.user.vpbx_user_uid, `Bulk deleted ${result.deleted} users`);
    return result;
  }
}
