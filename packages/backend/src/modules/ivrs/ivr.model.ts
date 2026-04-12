import { Table, Column, Model, DataType, PrimaryKey, AutoIncrement } from 'sequelize-typescript';

@Table({ tableName: 'ivrs', timestamps: false, freezeTableName: true })
export class Ivr extends Model {
  @PrimaryKey
  @AutoIncrement
  @Column({ type: DataType.INTEGER })
  declare uid: number;

  @Column({ type: DataType.STRING(255), allowNull: false, defaultValue: '' })
  declare name: string;

  @Column({ type: DataType.STRING(255), allowNull: false, defaultValue: '' })
  declare exten: string;

  @Column({ type: DataType.STRING(255), allowNull: true })
  declare timeout: string | null;

  @Column({ type: DataType.INTEGER, allowNull: false, defaultValue: 0 })
  declare max_count: number;

  @Column({ type: DataType.TINYINT, allowNull: false, defaultValue: 1 })
  declare active: number;

  @Column({ type: DataType.TINYINT, allowNull: false, defaultValue: 1 })
  declare direct_dial: number;

  @Column({ type: DataType.JSON, defaultValue: [] })
  declare prompts: string[];

  // This will store an array of { digit: string, actions: any[] }
  @Column({ type: DataType.JSON, defaultValue: [] })
  declare menu_items: any[];

  @Column({ type: DataType.INTEGER, allowNull: false, defaultValue: 0 })
  declare user_uid: number;

  @Column({ type: DataType.DATE, field: 'created_at' })
  declare created_at: Date;

  @Column({ type: DataType.DATE, field: 'updated_at' })
  declare updated_at: Date;
}
