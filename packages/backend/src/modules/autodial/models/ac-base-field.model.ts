import {
  Table, Column, Model, DataType, PrimaryKey, AutoIncrement, Default, ForeignKey, BelongsTo,
} from 'sequelize-typescript';
import type { AutodialFieldType } from '@krasterisk/shared';
import { AcBase } from './ac-base.model';

@Table({
  tableName: 'ac_base_fields',
  timestamps: false,
  freezeTableName: true,
})
export class AcBaseField extends Model {
  @PrimaryKey
  @AutoIncrement
  @Column(DataType.INTEGER)
  declare uid: number;

  @ForeignKey(() => AcBase)
  @Column({ type: DataType.INTEGER, allowNull: false })
  declare base_uid: number;

  @Column({ type: DataType.STRING(64), allowNull: false })
  declare key: string;

  @Column({ type: DataType.STRING(255), allowNull: false })
  declare label: string;

  @Column({ type: DataType.STRING(16), allowNull: false })
  declare type: AutodialFieldType;

  @Default(false)
  @Column({ type: DataType.BOOLEAN, allowNull: false })
  declare required: boolean;

  @Default(0)
  @Column({ type: DataType.INTEGER, allowNull: false })
  declare position: number;

  @Default(false)
  @Column({ type: DataType.BOOLEAN, allowNull: false })
  declare is_phone: boolean;

  @Default('')
  @Column({ type: DataType.STRING(64), allowNull: false })
  declare var_name: string;

  @Column({ type: DataType.JSON, allowNull: true })
  declare enum_values: string[] | null;

  @BelongsTo(() => AcBase, { foreignKey: 'base_uid' })
  declare base?: AcBase;
}
