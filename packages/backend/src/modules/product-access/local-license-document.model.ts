import {
  Table, Column, Model, DataType, PrimaryKey, AllowNull,
} from 'sequelize-typescript';

@Table({
  tableName: 'ai_local_license_documents', timestamps: false,
  indexes: [
    { unique: true, fields: ['license_id', 'revision'], name: 'uq_ai_license_revision' },
    { fields: ['vpbx_user_uid'], name: 'idx_ai_license_tenant' },
  ],
})
export class LocalLicenseDocument extends Model {
  @PrimaryKey
  @AllowNull(false)
  @Column(DataType.STRING(36))
  declare uid: string;

  @AllowNull(false)
  @Column(DataType.STRING(36))
  declare license_id: string;

  @AllowNull(false)
  @Column(DataType.INTEGER)
  declare revision: number;

  @AllowNull(false)
  @Column({ type: DataType.INTEGER, field: 'vpbx_user_uid' })
  declare user_uid: number;

  @AllowNull(false)
  @Column(DataType.STRING(128))
  declare installation_id: string;

  @AllowNull(false)
  @Column(DataType.BLOB('long'))
  declare payload_bytes: Buffer;

  @AllowNull(false)
  @Column(DataType.BLOB)
  declare signature_bytes: Buffer;

  @AllowNull(false)
  @Column(DataType.STRING(64))
  declare digest_sha256: string;

  @AllowNull(false)
  @Column(DataType.DATE)
  declare imported_at: Date;

  @AllowNull(false)
  @Column(DataType.INTEGER)
  declare imported_by: number;

  @AllowNull(false)
  @Column(DataType.DATE)
  declare max_observed_at: Date;
}
