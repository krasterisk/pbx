import {
  Injectable, NotFoundException, BadRequestException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/sequelize';
import { Sequelize } from 'sequelize-typescript';
import { BillingSeller } from './billing-seller.model';
import { Tenant } from './tenant.model';

export interface SellerDto {
  name: string;
  inn?: string | null;
  kpp?: string | null;
  ogrn?: string | null;
  address?: string | null;
  bankName?: string | null;
  bankBik?: string | null;
  bankAccount?: string | null;
  corrAccount?: string | null;
  serviceDescription?: string | null;
  serviceCode?: string | null;
  isDefault?: boolean;
}

export type UpdateSellerDto = Partial<SellerDto>;

@Injectable()
export class BillingSellersService {
  constructor(
    @InjectModel(BillingSeller) private readonly sellerModel: typeof BillingSeller,
    @InjectModel(Tenant) private readonly tenantModel: typeof Tenant,
    private readonly sequelize: Sequelize,
  ) {}

  async findAll(): Promise<BillingSeller[]> {
    return this.sellerModel.findAll({ order: [['isDefault', 'DESC'], ['name', 'ASC']] });
  }

  async findOne(id: number): Promise<BillingSeller> {
    const row = await this.sellerModel.findByPk(id);
    if (!row) throw new NotFoundException(`Seller #${id} not found`);
    return row;
  }

  async findDefault(): Promise<BillingSeller> {
    const row = await this.sellerModel.findOne({ where: { isDefault: true }, order: [['id', 'ASC']] });
    if (!row) throw new BadRequestException('No default seller configured');
    return row;
  }

  async create(dto: SellerDto): Promise<BillingSeller> {
    return this.sequelize.transaction(async (t) => {
      const makeDefault = dto.isDefault === true;
      if (makeDefault) {
        await this.sellerModel.update(
          { isDefault: false },
          { where: { isDefault: true }, transaction: t },
        );
      }
      const count = await this.sellerModel.count({ transaction: t });
      return this.sellerModel.create({
        name: dto.name.trim(),
        inn: dto.inn ?? null,
        kpp: dto.kpp ?? null,
        ogrn: dto.ogrn ?? null,
        address: dto.address ?? null,
        bankName: dto.bankName ?? null,
        bankBik: dto.bankBik ?? null,
        bankAccount: dto.bankAccount ?? null,
        corrAccount: dto.corrAccount ?? null,
        serviceDescription: dto.serviceDescription ?? null,
        serviceCode: dto.serviceCode ?? null,
        isDefault: makeDefault || count === 0,
      } as any, { transaction: t });
    });
  }

  async update(id: number, dto: UpdateSellerDto): Promise<BillingSeller> {
    const seller = await this.findOne(id);
    if (dto.isDefault === false && seller.isDefault) {
      throw new BadRequestException('Cannot unset default flag; set another seller as default first');
    }
    await seller.update({
      ...(dto.name !== undefined ? { name: dto.name.trim() } : {}),
      ...(dto.inn !== undefined ? { inn: dto.inn } : {}),
      ...(dto.kpp !== undefined ? { kpp: dto.kpp } : {}),
      ...(dto.ogrn !== undefined ? { ogrn: dto.ogrn } : {}),
      ...(dto.address !== undefined ? { address: dto.address } : {}),
      ...(dto.bankName !== undefined ? { bankName: dto.bankName } : {}),
      ...(dto.bankBik !== undefined ? { bankBik: dto.bankBik } : {}),
      ...(dto.bankAccount !== undefined ? { bankAccount: dto.bankAccount } : {}),
      ...(dto.corrAccount !== undefined ? { corrAccount: dto.corrAccount } : {}),
      ...(dto.serviceDescription !== undefined ? { serviceDescription: dto.serviceDescription } : {}),
      ...(dto.serviceCode !== undefined ? { serviceCode: dto.serviceCode } : {}),
    });
    if (dto.isDefault === true) {
      return this.setDefault(id);
    }
    return this.findOne(id);
  }

  async setDefault(id: number): Promise<BillingSeller> {
    return this.sequelize.transaction(async (t) => {
      const seller = await this.sellerModel.findByPk(id, { transaction: t });
      if (!seller) throw new NotFoundException(`Seller #${id} not found`);
      await this.sellerModel.update(
        { isDefault: false },
        { where: { isDefault: true }, transaction: t },
      );
      await seller.update({ isDefault: true }, { transaction: t });
      return seller;
    });
  }

  async remove(id: number): Promise<{ success: true }> {
    return this.sequelize.transaction(async (t) => {
      const seller = await this.sellerModel.findByPk(id, { transaction: t });
      if (!seller) throw new NotFoundException(`Seller #${id} not found`);
      if (seller.isDefault) {
        throw new BadRequestException(
          'Cannot delete the default seller. Set another seller as default first.',
        );
      }
      const def = await this.sellerModel.findOne({
        where: { isDefault: true },
        transaction: t,
        order: [['id', 'ASC']],
      });
      if (!def) throw new BadRequestException('No default seller configured');
      await this.tenantModel.update(
        { seller_id: def.id } as any,
        { where: { seller_id: id }, transaction: t },
      );
      await seller.destroy({ transaction: t });
      return { success: true as const };
    });
  }

  toApi(row: BillingSeller) {
    return {
      id: row.id,
      name: row.name,
      inn: row.inn ?? '',
      kpp: row.kpp ?? '',
      ogrn: row.ogrn ?? '',
      address: row.address ?? '',
      bankName: row.bankName ?? '',
      bankBik: row.bankBik ?? '',
      bankAccount: row.bankAccount ?? '',
      corrAccount: row.corrAccount ?? '',
      serviceDescription: row.serviceDescription ?? '',
      serviceCode: row.serviceCode ?? '',
      isDefault: !!row.isDefault,
      created_at: row.created_at,
      updated_at: row.updated_at,
    };
  }
}
