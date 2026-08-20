import { Column, DataType, Model, Table } from 'sequelize-typescript';
import type { RingStrategy } from '@krasterisk/shared';

@Table({ tableName: 'call_groups', timestamps: false })
export class CallGroup extends Model {
  @Column({ primaryKey: true, autoIncrement: true, type: DataType.INTEGER })
  declare uid: number;

  @Column({ type: DataType.STRING(128), allowNull: false })
  declare name: string;

  /** Tenant-unique number; NOT NULL after migrate-call-groups-exten */
  @Column({ type: DataType.STRING(8), allowNull: false })
  declare exten: string;

  @Column({
    type: DataType.ENUM('ringall', 'hunt', 'memoryhunt', 'random'),
    allowNull: false,
  })
  declare strategy: RingStrategy;

  @Column({ type: DataType.INTEGER, allowNull: false, defaultValue: 25 })
  declare ring_time: number;

  @Column({ type: DataType.STRING(128), allowNull: true })
  declare external_context: string | null;

  @Column({ type: DataType.STRING(64), allowNull: true })
  declare cid_prefix: string | null;

  @Column({ type: DataType.INTEGER, allowNull: false, defaultValue: 0, field: 'vpbx_user_uid' })
  declare user_uid: number;

  @Column({ type: DataType.BOOLEAN, allowNull: false, defaultValue: false, field: 'confirm_external' })
  declare confirmExternal: boolean;

  @Column({ type: DataType.BOOLEAN, allowNull: false, defaultValue: false, field: 'skip_busy' })
  declare skipBusy: boolean;

  @Column({ type: DataType.STRING(128), allowNull: true, field: 'greeting_prompt' })
  declare greetingPrompt: string | null;

  @Column({ type: DataType.STRING(64), allowNull: true, field: 'moh_class' })
  declare mohClass: string | null;

  @Column({ type: DataType.BOOLEAN, allowNull: false, defaultValue: false, field: 'use_moh_instead_of_ringback' })
  declare useMohInsteadOfRingback: boolean;

  @Column({ type: DataType.STRING(64), allowNull: false, defaultValue: 'tT', field: 'dial_options' })
  declare dialOptions: string;
}
