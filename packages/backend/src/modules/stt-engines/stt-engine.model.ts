import { Table, Column, Model, DataType, PrimaryKey, AutoIncrement } from 'sequelize-typescript';

@Table({ tableName: 'stt_engines', timestamps: false, freezeTableName: true })
export class SttEngine extends Model {
  @PrimaryKey
  @AutoIncrement
  @Column({ type: DataType.INTEGER })
  declare uid: number;

  @Column({ type: DataType.STRING(128), allowNull: false })
  declare name: string;

  @Column({ type: DataType.STRING(32), allowNull: false, defaultValue: 'custom' })
  declare type: 'google' | 'yandex' | 'custom';

  @Column({ type: DataType.TEXT, allowNull: true })
  declare token: string;

  @Column({ type: DataType.JSON, allowNull: true })
  declare settings: Record<string, any>;

  @Column({ type: DataType.STRING(512), allowNull: true })
  declare custom_url: string;

  @Column({ type: DataType.STRING(32), allowNull: true, defaultValue: 'none' })
  declare auth_mode: 'none' | 'bearer' | 'custom';

  @Column({ type: DataType.JSON, allowNull: true })
  declare custom_headers: Record<string, string>;

  @Column({ type: DataType.INTEGER, allowNull: false, defaultValue: 0 })
  declare user_uid: number;
}
