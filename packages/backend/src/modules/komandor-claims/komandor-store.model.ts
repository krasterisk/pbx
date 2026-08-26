import { Table, Column, Model, DataType, PrimaryKey, AutoIncrement, Default } from 'sequelize-typescript';
import type { KomandorPerson } from './komandor-claim.model';

@Table({ tableName: 'komandor_stores', timestamps: false, freezeTableName: true })
export class KomandorStore extends Model {
  @PrimaryKey
  @AutoIncrement
  @Column({ type: DataType.INTEGER })
  declare uid: number;

  @Column({ type: DataType.STRING(32), allowNull: true })
  declare code: string | null;

  @Column({ type: DataType.STRING(255), allowNull: false })
  declare name: string;

  @Column({ type: DataType.STRING(512), allowNull: true })
  declare address: string | null;

  @Column({ type: DataType.STRING(128), allowNull: true })
  declare city: string | null;

  @Column({ type: DataType.JSON, allowNull: true })
  declare directors: KomandorPerson[] | null;

  @Column({ type: DataType.JSON, allowNull: true })
  declare zdf: KomandorPerson[] | null;

  @Default(1)
  @Column({ type: DataType.TINYINT, allowNull: false })
  declare is_active: number;

  @Default(0)
  @Column({ type: DataType.INTEGER, allowNull: false })
  declare user_uid: number;
}
