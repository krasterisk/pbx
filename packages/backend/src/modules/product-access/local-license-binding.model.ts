import {
  Table, Column, Model, DataType, PrimaryKey, AllowNull,
} from 'sequelize-typescript';

@Table({ tableName: 'ai_local_license_bindings', timestamps: false })
export class LocalLicenseBinding extends Model {
  @PrimaryKey
  @AllowNull(false)
  @Column({ type: DataType.INTEGER, field: 'vpbx_user_uid' })
  declare user_uid: number;

  @PrimaryKey
  @AllowNull(false)
  @Column(DataType.STRING(64))
  declare product: string;

  @AllowNull(false)
  @Column(DataType.STRING(36))
  declare document_uid: string;

  @AllowNull(false)
  @Column(DataType.INTEGER)
  declare revision: number;

  @AllowNull(false)
  @Column(DataType.INTEGER)
  declare actor_user_id: number;

  @AllowNull(false)
  @Column(DataType.DATE)
  declare updated_at: Date;
}
