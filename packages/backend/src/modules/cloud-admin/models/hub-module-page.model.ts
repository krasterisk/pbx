import {
  Table, Column, Model, DataType,
  PrimaryKey, AutoIncrement, Default, AllowNull, BelongsTo, ForeignKey,
} from 'sequelize-typescript';
import { HubModule } from './hub-module.model';

@Table({
  tableName: 'hub_module_pages',
  timestamps: false,
  indexes: [
    { unique: true, fields: ['hub_code', 'page_code'], name: 'uq_hub_module_page' },
    { fields: ['hub_code'], name: 'idx_hub_module_pages_hub' },
  ],
})
export class HubModulePage extends Model {
  @PrimaryKey
  @AutoIncrement
  @Column(DataType.INTEGER)
  declare id: number;

  @ForeignKey(() => HubModule)
  @AllowNull(false)
  @Column(DataType.STRING(64))
  declare hub_code: string;

  @AllowNull(false)
  @Column(DataType.STRING(64))
  declare page_code: string;

  @AllowNull(true)
  @Column(DataType.STRING(255))
  declare path: string | null;

  @Default(0)
  @Column(DataType.INTEGER)
  declare sort_order: number;

  @BelongsTo(() => HubModule, { foreignKey: 'hub_code', targetKey: 'code' })
  declare hubModule?: HubModule;
}
