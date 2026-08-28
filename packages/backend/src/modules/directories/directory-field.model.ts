import {
  Table, Column, Model, DataType, PrimaryKey, AutoIncrement,
  ForeignKey, BelongsTo, Default,
} from 'sequelize-typescript';
import type { DirectoryFieldType } from '@krasterisk/shared';
import { Directory } from './directory.model';

@Table({
  tableName: 'directory_fields',
  timestamps: false,
  freezeTableName: true,
  indexes: [
    { name: 'uq_directory_fields_key', unique: true, fields: ['directory_uid', 'key'] },
  ],
})
export class DirectoryField extends Model {
  @PrimaryKey
  @AutoIncrement
  @Column(DataType.INTEGER)
  declare uid: number;

  @ForeignKey(() => Directory)
  @Column({ type: DataType.INTEGER, allowNull: false })
  declare directory_uid: number;

  @Column({ type: DataType.STRING(64), allowNull: false })
  declare key: string;

  @Column({ type: DataType.STRING(255), allowNull: false })
  declare label: string;

  @Column({ type: DataType.STRING(16), allowNull: false })
  declare type: DirectoryFieldType;

  @Default(false)
  @Column({ type: DataType.BOOLEAN, allowNull: false })
  declare required: boolean;

  @Default(0)
  @Column({ type: DataType.INTEGER, allowNull: false })
  declare position: number;

  @BelongsTo(() => Directory, 'directory_uid')
  declare directory: Directory;
}
