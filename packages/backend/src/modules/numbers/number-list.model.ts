import { Table, Column, Model, DataType, PrimaryKey, AutoIncrement } from 'sequelize-typescript';

// "Numbers" (Списки доступа) — controls what each user/role can see:
// queues for joining, operator panels, supervisor stats, transfer panels,
// PBX settings visibility, CDR report scopes, etc.
@Table({ tableName: 'numbers' })
export class NumberList extends Model {
  @PrimaryKey
  @AutoIncrement
  @Column({ type: DataType.INTEGER })
  declare id: number;

  @Column({ type: DataType.STRING })
  declare name: string;

  @Column({ type: DataType.STRING, allowNull: true })
  declare comment: string;

  // JSON field containing all the access lists info
  @Column({ type: DataType.JSON, allowNull: true })
  declare numbers: any;

  @Column({ type: DataType.INTEGER, defaultValue: 0, field: 'vpbx_user_uid' })
  declare user_uid: number;
}
