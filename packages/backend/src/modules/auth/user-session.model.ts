import { Column, DataType, Model, Table } from 'sequelize-typescript';

@Table({ tableName: 'user_sessions', timestamps: true })
export class UserSession extends Model {
  @Column({ type: DataType.INTEGER, autoIncrement: true, primaryKey: true })
  declare id: number;

  @Column({ type: DataType.INTEGER, allowNull: false })
  declare user_id: number;

  @Column({ type: DataType.STRING(512), allowNull: false })
  declare refreshToken: string;

  @Column({ type: DataType.TEXT, allowNull: true })
  declare userAgent: string | null;

  @Column({ type: DataType.STRING(45), allowNull: true })
  declare ipAddress: string | null;

  @Column({ type: DataType.BIGINT, allowNull: false })
  declare expiresAt: number;
}
