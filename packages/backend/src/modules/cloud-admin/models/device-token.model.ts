import {
  Table, Column, Model, DataType,
  PrimaryKey, AutoIncrement, AllowNull, Default,
} from 'sequelize-typescript';

/**
 * FCM / push device token bound to user + tenant (NAV-12 / D-32).
 * Upsert key: (user_uid, tenant_id).
 */
@Table({
  tableName: 'device_tokens',
  timestamps: true,
  updatedAt: 'updated_at',
  createdAt: 'created_at',
  indexes: [
    {
      unique: true,
      fields: ['user_uid', 'tenant_id'],
      name: 'uq_device_tokens_user_tenant',
    },
    {
      fields: ['tenant_id'],
      name: 'idx_device_tokens_tenant',
    },
  ],
})
export class DeviceToken extends Model {
  @PrimaryKey
  @AutoIncrement
  @Column(DataType.INTEGER)
  declare id: number;

  @AllowNull(false)
  @Column(DataType.INTEGER)
  declare user_uid: number;

  @AllowNull(false)
  @Column(DataType.INTEGER)
  declare tenant_id: number;

  @AllowNull(false)
  @Column(DataType.STRING(4096))
  declare token: string;

  @AllowNull(true)
  @Default(null)
  @Column(DataType.STRING(32))
  declare platform: string | null;

  @Column(DataType.DATE)
  declare created_at: Date;

  @Column(DataType.DATE)
  declare updated_at: Date;
}
