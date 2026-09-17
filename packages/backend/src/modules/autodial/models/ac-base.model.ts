import {
  Table, Column, Model, DataType, PrimaryKey, AutoIncrement,
  HasMany, CreatedAt, UpdatedAt, Default,
} from 'sequelize-typescript';
import type { AutodialDedupPolicy, AutodialPhoneNormalization } from '@krasterisk/shared';
import { AcBaseField } from './ac-base-field.model';
import { AcContact } from './ac-contact.model';

@Table({
  tableName: 'ac_bases',
  timestamps: true,
  createdAt: 'created_at',
  updatedAt: 'updated_at',
  freezeTableName: true,
})
export class AcBase extends Model {
  @PrimaryKey
  @AutoIncrement
  @Column(DataType.INTEGER)
  declare uid: number;

  @Column({ type: DataType.INTEGER, allowNull: false, field: 'vpbx_user_uid' })
  declare user_uid: number;

  @Column({ type: DataType.STRING(255), allowNull: false })
  declare name: string;

  @Default('')
  @Column({ type: DataType.STRING(512), allowNull: false })
  declare description: string;

  @Default('phone')
  @Column({ type: DataType.STRING(16), allowNull: false })
  declare dedup_policy: AutodialDedupPolicy;

  @Default('ru_8_to_7')
  @Column({ type: DataType.STRING(16), allowNull: false })
  declare phone_normalization: AutodialPhoneNormalization;

  @Default(0)
  @Column({ type: DataType.INTEGER, allowNull: false })
  declare revision: number;

  @CreatedAt
  declare created_at: Date;

  @UpdatedAt
  declare updated_at: Date;

  @HasMany(() => AcBaseField, { foreignKey: 'base_uid', as: 'fields' })
  declare fields?: AcBaseField[];

  @HasMany(() => AcContact, { foreignKey: 'base_uid', as: 'contacts' })
  declare contacts?: AcContact[];
}
