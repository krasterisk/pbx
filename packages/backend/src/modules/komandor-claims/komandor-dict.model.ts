import { Table, Column, Model, DataType, PrimaryKey, AutoIncrement, Default } from 'sequelize-typescript';

export type KomandorDictKind = 'channel' | 'topic' | 'subtopic';

@Table({ tableName: 'komandor_dict', timestamps: false, freezeTableName: true })
export class KomandorDict extends Model {
  @PrimaryKey
  @AutoIncrement
  @Column({ type: DataType.INTEGER })
  declare uid: number;

  @Column({ type: DataType.STRING(32), allowNull: false })
  declare kind: KomandorDictKind;

  @Column({ type: DataType.STRING(255), allowNull: false })
  declare name: string;

  @Column({ type: DataType.STRING(255), allowNull: true })
  declare parent_name: string | null;

  @Default(0)
  @Column({ type: DataType.INTEGER, allowNull: false })
  declare sort_order: number;

  @Default(1)
  @Column({ type: DataType.TINYINT, allowNull: false })
  declare is_active: number;
}
