import {
  Table, Column, Model, DataType, PrimaryKey, AutoIncrement, CreatedAt, Default,
} from 'sequelize-typescript';
import type { AutodialDncScope } from '@krasterisk/shared';

@Table({
  tableName: 'ac_dnc',
  timestamps: false,
  freezeTableName: true,
})
export class AcDnc extends Model {
  @PrimaryKey
  @AutoIncrement
  @Column(DataType.INTEGER)
  declare uid: number;

  @Column({ type: DataType.INTEGER, allowNull: false, field: 'vpbx_user_uid' })
  declare user_uid: number;

  @Default('global')
  @Column({ type: DataType.STRING(16), allowNull: false })
  declare scope: AutodialDncScope;

  @Column({ type: DataType.INTEGER, allowNull: true })
  declare scope_uid: number | null;

  @Column({ type: DataType.STRING(64), allowNull: false })
  declare normalized_phone: string;

  @Default('')
  @Column({ type: DataType.STRING(255), allowNull: false })
  declare reason: string;

  @Default('manual')
  @Column({ type: DataType.STRING(64), allowNull: false })
  declare source: string;

  @Column({ type: DataType.DATE, allowNull: true })
  declare expires_at: Date | null;

  @CreatedAt
  @Column({ type: DataType.DATE, allowNull: false })
  declare created_at: Date;
}
