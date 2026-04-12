import { Table, Column, Model, DataType, PrimaryKey, AutoIncrement, ForeignKey, BelongsTo, Index } from 'sequelize-typescript';
import { Context } from '../contexts/context.model';

@Table({ tableName: 'routes', timestamps: false, freezeTableName: true })
export class Route extends Model {
  @PrimaryKey
  @AutoIncrement
  @Column({ type: DataType.INTEGER })
  declare uid: number;

  @ForeignKey(() => Context)
  @Column({ type: DataType.INTEGER, allowNull: false })
  declare context_uid: number;

  @Column({ type: DataType.STRING(255), allowNull: false, defaultValue: '' })
  declare name: string;

  @Column({ type: DataType.JSON, allowNull: false })
  declare extensions: string[];

  @Column({ type: DataType.INTEGER, allowNull: false, defaultValue: 0 })
  declare priority: number;

  @Column({ type: DataType.TINYINT, allowNull: false, defaultValue: 1 })
  declare active: number;

  @Column({ type: DataType.JSON, defaultValue: null })
  declare options: Record<string, any> | null;

  @Column({ type: DataType.JSON, defaultValue: null })
  declare webhooks: Record<string, any> | null;

  @Column({ type: DataType.JSON, allowNull: false })
  declare actions: any[];

  @Column({ type: DataType.TEXT, defaultValue: null })
  declare raw_dialplan: string | null;

  @Column({ type: DataType.INTEGER, allowNull: false, defaultValue: 0 })
  declare user_uid: number;

  @Column({ type: DataType.DATE, field: 'created_at' })
  declare created_at: Date;

  @Column({ type: DataType.DATE, field: 'updated_at' })
  declare updated_at: Date;

  @BelongsTo(() => Context, 'context_uid')
  declare context: Context;
}
