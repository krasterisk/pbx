import {
  Table, Column, Model, DataType, PrimaryKey, AutoIncrement, CreatedAt, Default, ForeignKey,
} from 'sequelize-typescript';
import { AcBase } from './ac-base.model';

@Table({
  tableName: 'ac_import_runs',
  timestamps: false,
  freezeTableName: true,
})
export class AcImportRun extends Model {
  @PrimaryKey
  @AutoIncrement
  @Column(DataType.INTEGER)
  declare uid: number;

  @ForeignKey(() => AcBase)
  @Column({ type: DataType.INTEGER, allowNull: false })
  declare base_uid: number;

  @Column({ type: DataType.INTEGER, allowNull: false, field: 'vpbx_user_uid' })
  declare user_uid: number;

  @Column({ type: DataType.INTEGER, allowNull: true })
  declare profile_uid: number | null;

  @Default('')
  @Column({ type: DataType.STRING(512), allowNull: false })
  declare filename: string;

  @Default(0)
  @Column({ type: DataType.INTEGER, allowNull: false })
  declare total_rows: number;

  @Default(0)
  @Column({ type: DataType.INTEGER, allowNull: false })
  declare imported: number;

  @Default(0)
  @Column({ type: DataType.INTEGER, allowNull: false })
  declare skipped: number;

  @Column({ type: DataType.JSON, allowNull: true })
  declare errors: Array<{ row: number; code: string; message: string }> | null;

  @CreatedAt
  @Column({ type: DataType.DATE, allowNull: false })
  declare created_at: Date;
}
