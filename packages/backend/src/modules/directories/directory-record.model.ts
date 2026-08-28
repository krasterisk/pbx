import {
  Table, Column, Model, DataType, PrimaryKey, AutoIncrement,
  ForeignKey, BelongsTo, CreatedAt, UpdatedAt, Default,
} from 'sequelize-typescript';
import type { DirectoryMatchKind } from '@krasterisk/shared';
import { Directory } from './directory.model';

@Table({
  tableName: 'directory_records',
  timestamps: true,
  createdAt: 'created_at',
  updatedAt: 'updated_at',
  freezeTableName: true,
  indexes: [
    {
      name: 'uq_directory_exact_key',
      unique: true,
      fields: ['directory_uid', 'normalized_lookup_value', 'match_kind'],
    },
    { name: 'idx_directory_patterns', fields: ['directory_uid', 'match_kind', 'priority'] },
  ],
})
export class DirectoryRecord extends Model {
  @PrimaryKey
  @AutoIncrement
  @Column(DataType.INTEGER)
  declare uid: number;

  @ForeignKey(() => Directory)
  @Column({ type: DataType.INTEGER, allowNull: false })
  declare directory_uid: number;

  @Column({ type: DataType.STRING(255), allowNull: false })
  declare lookup_value: string;

  @Column({ type: DataType.STRING(255), allowNull: false })
  declare normalized_lookup_value: string;

  @Column({ type: DataType.STRING(24), allowNull: false })
  declare match_kind: DirectoryMatchKind;

  @Column({ type: DataType.INTEGER, allowNull: false })
  declare priority: number;

  @Column({ type: DataType.JSON, allowNull: false })
  declare values: Record<string, string | number | boolean>;

  @Default('')
  @Column({ type: DataType.STRING(255), allowNull: false })
  declare comment: string;

  @CreatedAt
  @Column(DataType.DATE)
  declare created_at: Date;

  @UpdatedAt
  @Column(DataType.DATE)
  declare updated_at: Date;

  @BelongsTo(() => Directory, 'directory_uid')
  declare directory: Directory;
}
