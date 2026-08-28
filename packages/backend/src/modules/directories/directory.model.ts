import {
  Table, Column, Model, DataType, PrimaryKey, AutoIncrement,
  HasMany, CreatedAt, UpdatedAt, Default, AllowNull,
} from 'sequelize-typescript';
import type { DirectoryKeyNormalization } from '@krasterisk/shared';
import { DirectoryField } from './directory-field.model';
import { DirectoryRecord } from './directory-record.model';
import { RouteDirectoryBinding } from './route-directory-binding.model';

@Table({
  tableName: 'directories',
  timestamps: true,
  createdAt: 'created_at',
  updatedAt: 'updated_at',
  freezeTableName: true,
  indexes: [
    { name: 'idx_directories_user_uid', fields: ['user_uid'] },
    { name: 'uq_directories_tenant_name', unique: true, fields: ['user_uid', 'name'] },
  ],
})
export class Directory extends Model {
  @PrimaryKey
  @AutoIncrement
  @Column(DataType.INTEGER)
  declare uid: number;

  @Column({ type: DataType.INTEGER, allowNull: false })
  declare user_uid: number;

  @Column({ type: DataType.STRING(255), allowNull: false })
  declare name: string;

  @Default('')
  @Column({ type: DataType.STRING(255), allowNull: false })
  declare description: string;

  /** Nullable at the DB until fields exist; create payloads use lookupFieldKey. */
  @AllowNull(true)
  @Column({ type: DataType.INTEGER, defaultValue: null })
  declare lookup_field_uid: number | null;

  @Default('none')
  @Column({ type: DataType.STRING(16), allowNull: false })
  declare key_normalization: DirectoryKeyNormalization;

  @Default(0)
  @Column({ type: DataType.INTEGER, allowNull: false })
  declare revision: number;

  @CreatedAt
  @Column(DataType.DATE)
  declare created_at: Date;

  @UpdatedAt
  @Column(DataType.DATE)
  declare updated_at: Date;

  @HasMany(() => DirectoryField, 'directory_uid')
  declare fields: DirectoryField[];

  @HasMany(() => DirectoryRecord, 'directory_uid')
  declare records: DirectoryRecord[];

  @HasMany(() => RouteDirectoryBinding, { foreignKey: 'directory_uid', as: 'bindings' })
  declare bindings: RouteDirectoryBinding[];
}
