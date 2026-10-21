import { Column, DataType, Model, Table } from 'sequelize-typescript';

/** One owner row per user; also serializes acquisitions across application instances. */
@Table({ tableName: 'phone_sessions', timestamps: false })
export class PhoneSession extends Model {
  @Column({ type: DataType.INTEGER, primaryKey: true }) declare tenant: number;
  @Column({ type: DataType.INTEGER, primaryKey: true }) declare user_id: number;
  @Column({ type: DataType.STRING(255), allowNull: true }) declare endpoint: string | null;
  @Column({ type: DataType.STRING(8), allowNull: true }) declare mode: 'sip' | 'webrtc' | null;
  @Column({ type: DataType.STRING(64), allowNull: true }) declare owner_hash: string | null;
  @Column({ type: DataType.BIGINT, allowNull: false, defaultValue: 0 }) declare expires_at: number;
  @Column({ type: DataType.BIGINT, allowNull: false, defaultValue: 0 }) declare dial_pending_until: number;
}
