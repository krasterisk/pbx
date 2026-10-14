import {
  Controller, Get, Post, Body, Param, ParseIntPipe,
  UseGuards, Req, Query, NotFoundException,
} from '@nestjs/common';
import {
  ApiTags, ApiBearerAuth, ApiOperation, ApiQuery,
} from '@nestjs/swagger';
import {
  IsNumber, Min, IsOptional, IsString, MaxLength,
} from 'class-validator';
import { JwtAuthGuard } from '../../auth/jwt-auth.guard';
import { SuperAdminGuard } from '../../auth/superadmin.guard';
import { BillingBalanceService } from './billing-balance.service';
import { InjectModel } from '@nestjs/sequelize';
import { Tenant } from '../tenant.model';
import { resolveTenantIdFromJwt } from '../tenant-binding';

class DepositDto {
  @IsNumber()
  @Min(0.01)
  amount!: number; // рубли

  @IsOptional()
  @IsString()
  @MaxLength(512)
  description?: string;
}

class ChargeDto {
  @IsNumber()
  @Min(0.01)
  amount!: number;

  @IsOptional()
  @IsString()
  @MaxLength(512)
  description?: string;

  @IsOptional()
  @IsString()
  module_code?: string;
}

// ──────────────────────────────────────────────────────────
// SuperAdmin: /api/cloud-admin/billing/tenants/:id/*
// ──────────────────────────────────────────────────────────

@ApiTags('Cloud Admin — Billing')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, SuperAdminGuard)
@Controller('cloud-admin/billing/tenants/:id')
export class BillingAdminController {
  constructor(private readonly billingService: BillingBalanceService) {}

  @Get('balance')
  @ApiOperation({ summary: 'Баланс тенанта' })
  getBalance(@Param('id', ParseIntPipe) id: number) {
    return this.billingService.getBalance(id);
  }

  @Get('transactions')
  @ApiOperation({ summary: 'История транзакций тенанта' })
  @ApiQuery({ name: 'limit', required: false })
  @ApiQuery({ name: 'offset', required: false })
  getTransactions(
    @Param('id', ParseIntPipe) id: number,
    @Query('limit') limit?: string,
    @Query('offset') offset?: string,
  ) {
    return this.billingService.getTransactions(id, Number(limit) || 50, Number(offset) || 0);
  }

  @Post('deposit')
  @ApiOperation({ summary: 'Пополнить баланс тенанта' })
  deposit(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: DepositDto,
    @Req() req: any,
  ) {
    return this.billingService.deposit(id, dto.amount, req.user.sub, dto.description);
  }

  @Post('charge')
  @ApiOperation({ summary: 'Ручное списание / корректировка' })
  charge(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: ChargeDto,
    @Req() req: any,
  ) {
    return this.billingService.charge(id, dto.amount, req.user.sub, dto.description, dto.module_code);
  }
}

// ──────────────────────────────────────────────────────────
// Tenant Admin: /api/billing/*  (read-only)
// ──────────────────────────────────────────────────────────

@ApiTags('Billing — Tenant')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('billing')
export class BillingTenantController {
  constructor(
    private readonly billingService: BillingBalanceService,
    @InjectModel(Tenant) private readonly tenants: typeof Tenant,
  ) {}

  private async tenantId(req: { user?: { tenant_id?: number; vpbx_user_uid?: number } }): Promise<number> {
    const id = await resolveTenantIdFromJwt(req.user, (uid) => this.tenants.findOne({
      where: { vpbx_user_uid: uid }, attributes: ['id'],
    }));
    if (id === null) throw new NotFoundException('Tenant cabinet is not configured');
    return id;
  }

  @Get('balance')
  @ApiOperation({ summary: 'Мой баланс' })
  async getMyBalance(@Req() req: any) {
    return this.billingService.getBalance(await this.tenantId(req));
  }

  @Get('transactions')
  @ApiOperation({ summary: 'Моя история платежей' })
  @ApiQuery({ name: 'limit', required: false })
  @ApiQuery({ name: 'offset', required: false })
  async getMyTransactions(
    @Req() req: any,
    @Query('limit') limit?: string,
    @Query('offset') offset?: string,
  ) {
    const size = Math.min(100, Math.max(1, Math.floor(Number(limit) || 50)));
    const skip = Math.min(1_000_000, Math.max(0, Math.floor(Number(offset) || 0)));
    return this.billingService.getTransactions(await this.tenantId(req), size, skip);
  }
}
