import {
  Table, Column, Model, DataType, PrimaryKey, AutoIncrement,
  CreatedAt, UpdatedAt, Default, ForeignKey,
} from 'sequelize-typescript';
import type {
  AutodialDedupPolicy,
  AutodialImportSource,
  IAutodialColumnMap,
} from '@krasterisk/shared';
import { AcBase } from './ac-base.model';

@Table({
  tableName: 'ac_import_profiles',
  timestamps: true,
  createdAt: 'created_at',
  updatedAt: 'updated_at',
  freezeTableName: true,
})
export class AcImportProfile extends Model {
  @PrimaryKey
  @AutoIncrement
  @Column(DataType.INTEGER)
  declare uid: number;

  @ForeignKey(() => AcBase)
  @Column({ type: DataType.INTEGER, allowNull: false })
  declare base_uid: number;

  @Column({ type: DataType.INTEGER, allowNull: false, field: 'vpbx_user_uid' })
  declare user_uid: number;

  @Column({ type: DataType.STRING(255), allowNull: false })
  declare name: string;

  @Default('csv')
  @Column({ type: DataType.STRING(8), allowNull: false })
  declare source: AutodialImportSource;

  @Default(';')
  @Column({ type: DataType.STRING(4), allowNull: false })
  declare delimiter: string;

  @Default('utf-8')
  @Column({ type: DataType.STRING(32), allowNull: false })
  declare encoding: string;

  @Default(true)
  @Column({ type: DataType.BOOLEAN, allowNull: false })
  declare has_header: boolean;

  @Column({ type: DataType.JSON, allowNull: false })
  declare column_map: IAutodialColumnMap[];

  @Default('phone')
  @Column({ type: DataType.STRING(16), allowNull: false })
  declare dedup_policy: AutodialDedupPolicy;

  @CreatedAt
  declare created_at: Date;

  @UpdatedAt
  declare updated_at: Date;
}
