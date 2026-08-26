import { Table, Column, Model, DataType, PrimaryKey, AutoIncrement, Default } from 'sequelize-typescript';

export type KomandorClaimStatus = 'new' | 'in_progress' | 'completed' | 'postponed' | 'impossible';
export type KomandorSentiment = 'negative' | 'neutral' | 'positive';
export type KomandorNotifyStatus = 'not_sent' | 'sent' | 'failed';

export interface KomandorPerson {
  name: string;
  email?: string;
}

export interface KomandorDeptMessage {
  at: string;
  author: string;
  text: string;
}

@Table({ tableName: 'komandor_claims', timestamps: false, freezeTableName: true })
export class KomandorClaim extends Model {
  @PrimaryKey
  @AutoIncrement
  @Column({ type: DataType.BIGINT })
  declare uid: number;

  @Column({ type: DataType.INTEGER, allowNull: true })
  declare operator_id: number | null;

  @Column({ type: DataType.STRING(255), allowNull: true })
  declare operator_name: string | null;

  @Column({ type: DataType.DATE, allowNull: false })
  declare request_date: Date;

  @Column({ type: DataType.STRING(128), allowNull: true })
  declare call_uniqueid: string | null;

  @Column({ type: DataType.STRING(64), allowNull: true, unique: true })
  declare request_number: string | null;

  @Column({ type: DataType.INTEGER, allowNull: true })
  declare store_id: number | null;

  @Column({ type: DataType.STRING(64), allowNull: true })
  declare store_code: string | null;

  @Column({ type: DataType.STRING(512), allowNull: true })
  declare store_name: string | null;

  @Column({ type: DataType.STRING(512), allowNull: true })
  declare store_address: string | null;

  @Column({ type: DataType.JSON, allowNull: true })
  declare directors: KomandorPerson[] | null;

  @Column({ type: DataType.JSON, allowNull: true })
  declare zdf: KomandorPerson[] | null;

  @Column({ type: DataType.JSON, allowNull: true })
  declare extra_recipients: KomandorPerson[] | null;

  @Column({ type: DataType.TEXT, allowNull: true })
  declare extra_emails: string | null;

  @Column({ type: DataType.STRING(64), allowNull: true })
  declare channel: string | null;

  @Column({ type: DataType.STRING(255), allowNull: true })
  declare topic: string | null;

  @Column({ type: DataType.STRING(255), allowNull: true })
  declare subtopic: string | null;

  @Column({ type: DataType.TEXT, allowNull: true })
  declare description: string | null;

  @Column({ type: DataType.TEXT, allowNull: true })
  declare contact_info: string | null;

  @Column({ type: DataType.STRING(32), allowNull: true })
  declare client_phone: string | null;

  @Column({ type: DataType.STRING(255), allowNull: true })
  declare client_email: string | null;

  @Default('neutral')
  @Column({ type: DataType.STRING(16), allowNull: false })
  declare sentiment: KomandorSentiment;

  @Column({ type: DataType.JSON, allowNull: true })
  declare department_log: KomandorDeptMessage[] | null;

  @Column({ type: DataType.TEXT, allowNull: true })
  declare customer_response: string | null;

  @Column({ type: DataType.STRING(255), allowNull: true })
  declare attachment_name: string | null;

  @Column({ type: DataType.STRING(255), allowNull: true })
  declare dept_attachment_name: string | null;

  @Default('new')
  @Column({ type: DataType.STRING(20), allowNull: false })
  declare request_status: KomandorClaimStatus;

  @Default('not_sent')
  @Column({ type: DataType.STRING(20), allowNull: false })
  declare sms_status: KomandorNotifyStatus;

  @Default('not_sent')
  @Column({ type: DataType.STRING(20), allowNull: false })
  declare email_status: KomandorNotifyStatus;

  @Default('not_sent')
  @Column({ type: DataType.STRING(20), allowNull: false })
  declare store_email_status: KomandorNotifyStatus;

  @Default(0)
  @Column({ type: DataType.INTEGER, allowNull: false })
  declare user_uid: number;

  @Default(DataType.NOW)
  @Column({ type: DataType.DATE, field: 'created_at' })
  declare created_at: Date;

  @Default(DataType.NOW)
  @Column({ type: DataType.DATE, field: 'updated_at' })
  declare updated_at: Date;
}
