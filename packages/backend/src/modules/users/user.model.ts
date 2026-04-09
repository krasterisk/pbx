import { Table, Column, Model, DataType, PrimaryKey, AutoIncrement } from 'sequelize-typescript';

export enum UserLevel {
  ADMIN = 1,
  OPERATOR = 2,
  SUPERVISOR = 3,
  READONLY = 5,
}

@Table({ tableName: 'users' })
export class User extends Model {
  @PrimaryKey
  @AutoIncrement
  @Column({ type: DataType.INTEGER })
  declare uniqueid: number;

  @Column({ type: DataType.STRING })
  declare login: string;

  @Column({ type: DataType.STRING })
  declare name: string;

  @Column({ type: DataType.STRING })
  declare passwd: string;

  @Column({ type: DataType.STRING, allowNull: true })
  declare email: string;

  @Column({ type: DataType.STRING, allowNull: true })
  declare exten: string;

  @Column({ type: DataType.INTEGER, defaultValue: UserLevel.OPERATOR })
  declare level: UserLevel;

  @Column({ type: DataType.INTEGER, allowNull: true })
  declare role: number;

  @Column({ type: DataType.INTEGER, allowNull: true })
  declare numbers_id: number;

  @Column({ type: DataType.STRING, allowNull: true })
  declare permit_extens: string;

  @Column({ type: DataType.INTEGER, defaultValue: 0 })
  declare listbook_edit: number;

  @Column({ type: DataType.INTEGER, defaultValue: 0 })
  declare oper_chanspy: number;

  @Column({ type: DataType.INTEGER, defaultValue: 0 })
  declare outbound_posttime: number;

  @Column({ type: DataType.INTEGER, defaultValue: 0 })
  declare suspension_time: number;

  @Column({ type: DataType.INTEGER, defaultValue: 0 })
  declare inactive_time: number;

  @Column({ type: DataType.INTEGER, defaultValue: 0 })
  declare user_uid: number;
}
