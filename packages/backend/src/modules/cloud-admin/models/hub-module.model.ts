import {
  Table, Column, Model, DataType,
  PrimaryKey, AutoIncrement, Default, AllowNull, Unique, HasMany,
} from 'sequelize-typescript';
import { HubModulePage } from './hub-module-page.model';

export type HubModuleKind = 'base' | 'market';

@Table({
  tableName: 'hub_modules',
  timestamps: false,
  indexes: [
    { unique: true, fields: ['code'], name: 'uq_hub_modules_code' },
  ],
})
export class HubModule extends Model {
  @PrimaryKey
  @AutoIncrement
  @Column(DataType.INTEGER)
  declare id: number;

  @Unique
  @AllowNull(false)
  @Column(DataType.STRING(64))
  declare code: string;

  @AllowNull(false)
  @Column(DataType.STRING(128))
  declare name: string;

  @AllowNull(false)
  @Default('base')
  @Column(DataType.ENUM('base', 'market'))
  declare kind: HubModuleKind;

  @Default(0)
  @Column(DataType.INTEGER)
  declare sort_order: number;

  @Default(false)
  @Column(DataType.BOOLEAN)
  declare requires_cloud: boolean;

  @HasMany(() => HubModulePage, { foreignKey: 'hub_code', sourceKey: 'code' })
  declare pages?: HubModulePage[];
}
