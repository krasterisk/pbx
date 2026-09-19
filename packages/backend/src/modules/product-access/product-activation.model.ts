import {
  Table, Column, Model, DataType, PrimaryKey, AllowNull, Default,
} from 'sequelize-typescript';

@Table({ tableName: 'ai_product_activation', timestamps: false })
export class ProductActivation extends Model {
  @PrimaryKey
  @AllowNull(false)
  @Column({ type: DataType.INTEGER, field: 'vpbx_user_uid' })
  declare user_uid: number;

  @PrimaryKey
  @AllowNull(false)
  @Column(DataType.STRING(64))
  declare product: string;

  @Default(false)
  @AllowNull(false)
  @Column(DataType.BOOLEAN)
  declare enabled: boolean;

  @Default(1)
  @AllowNull(false)
  @Column(DataType.INTEGER)
  declare revision: number;

  @AllowNull(false)
  @Column(DataType.INTEGER)
  declare actor_user_id: number;

  @AllowNull(false)
  @Column(DataType.DATE)
  declare updated_at: Date;
}
