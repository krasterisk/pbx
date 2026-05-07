import {
  Column, DataType, Model, Table, CreatedAt, UpdatedAt,
} from 'sequelize-typescript';

/**
 * cloud_settings — хранилище ключ-значение для настроек платформы.
 * Ключи формируют пространства имён через двоеточие:
 *   billing.seller.name, billing.seller.inn, billing.bank.bik, ...
 */
@Table({ tableName: 'cloud_settings', timestamps: true })
export class CloudSetting extends Model {
  @Column({ primaryKey: true, autoIncrement: true, type: DataType.INTEGER })
  declare id: number;

  @Column({ type: DataType.STRING(128), allowNull: false, unique: true })
  declare key: string;

  @Column({ type: DataType.TEXT, allowNull: true })
  declare value: string | null;

  @Column({ type: DataType.STRING(255), allowNull: true })
  declare description: string | null;

  @CreatedAt
  declare created_at: Date;

  @UpdatedAt
  declare updated_at: Date;
}
