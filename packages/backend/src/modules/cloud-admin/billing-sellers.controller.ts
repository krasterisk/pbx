import {
  Controller, Get, Post, Patch, Delete, Param, Body, UseGuards, ParseIntPipe,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { SuperAdminGuard } from '../auth/superadmin.guard';
import { BillingSellersService, SellerDto, UpdateSellerDto } from './billing-sellers.service';

@ApiTags('Cloud Admin — Sellers')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, SuperAdminGuard)
@Controller('cloud-admin/sellers')
export class BillingSellersController {
  constructor(private readonly sellers: BillingSellersService) {}

  @Get()
  @ApiOperation({ summary: 'Список поставщиков' })
  async findAll() {
    const rows = await this.sellers.findAll();
    return rows.map((r) => this.sellers.toApi(r));
  }

  @Get(':id')
  @ApiOperation({ summary: 'Поставщик по id' })
  async findOne(@Param('id', ParseIntPipe) id: number) {
    return this.sellers.toApi(await this.sellers.findOne(id));
  }

  @Post()
  @ApiOperation({ summary: 'Создать поставщика' })
  async create(@Body() body: SellerDto) {
    return this.sellers.toApi(await this.sellers.create(body));
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Обновить поставщика' })
  async update(@Param('id', ParseIntPipe) id: number, @Body() body: UpdateSellerDto) {
    return this.sellers.toApi(await this.sellers.update(id, body));
  }

  @Post(':id/set-default')
  @ApiOperation({ summary: 'Сделать поставщика дефолтным' })
  async setDefault(@Param('id', ParseIntPipe) id: number) {
    return this.sellers.toApi(await this.sellers.setDefault(id));
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Удалить поставщика (не дефолтного)' })
  remove(@Param('id', ParseIntPipe) id: number) {
    return this.sellers.remove(id);
  }
}
