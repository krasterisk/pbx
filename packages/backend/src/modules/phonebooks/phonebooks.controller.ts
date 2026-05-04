import {
  Controller, Get, Post, Put, Delete,
  Param, Body, Req, ParseIntPipe, UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { PhonebooksService } from './phonebooks.service';

@UseGuards(JwtAuthGuard)
@Controller('phonebooks')
export class PhonebooksController {
  constructor(private readonly phonebooksService: PhonebooksService) {}

  @Get()
  findAll(@Req() req: any) {
    return this.phonebooksService.findAll(req.user.vpbx_user_uid);
  }

  @Get(':id')
  findOne(@Param('id', ParseIntPipe) id: number, @Req() req: any) {
    return this.phonebooksService.findOne(id, req.user.vpbx_user_uid);
  }

  @Post()
  create(@Body() body: any, @Req() req: any) {
    return this.phonebooksService.create(body, req.user.vpbx_user_uid);
  }

  @Put(':id')
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body() body: any,
    @Req() req: any,
  ) {
    return this.phonebooksService.update(id, body, req.user.vpbx_user_uid);
  }

  @Delete(':id')
  async remove(@Param('id', ParseIntPipe) id: number, @Req() req: any) {
    await this.phonebooksService.remove(id, req.user.vpbx_user_uid);
    return { message: 'Phonebook deleted' };
  }

  @Post('bulk/delete')
  bulkRemove(@Body() body: { ids: number[] }, @Req() req: any) {
    return this.phonebooksService.bulkRemove(body.ids, req.user.vpbx_user_uid);
  }

  /**
   * CSV import endpoint.
   * Expects { csv: string } in body.
   */
  @Post(':id/import-csv')
  importCsv(
    @Param('id', ParseIntPipe) id: number,
    @Body() body: { csv: string },
    @Req() req: any,
  ) {
    return this.phonebooksService.importCsv(id, body.csv, req.user.vpbx_user_uid);
  }
}
