import {
  Table, Column, Model, DataType, PrimaryKey, AutoIncrement, Default,
} from 'sequelize-typescript';

/**
 * Short-lived originate hold so two backend workers cannot oversubscribe the
 * same finite trunk while AMI occupancy still shows the previous picture.
 */
@Table({
  tableName: 'ac_channel_reservations',
  timestamps: false,
  freezeTableName: true,
})
export class AcChannelReservation extends Model {
  @PrimaryKey
  @AutoIncrement
  @Column(DataType.INTEGER)
  declare uid: number;

  @Column({ type: DataType.INTEGER, allowNull: false, field: 'vpbx_user_uid' })
  declare user_uid: number;

  @Column({ type: DataType.INTEGER, allowNull: false })
  declare campaign_uid: number;

  @Column({ type: DataType.INTEGER, allowNull: false })
  declare task_uid: number;

  @Column({ type: DataType.STRING(128), allowNull: false })
  declare trunk_id: string;

  @Column({ type: DataType.STRING(64), allowNull: false })
  declare owner: string;

  @Column({ type: DataType.DATE, allowNull: false })
  declare expires_at: Date;

  @Default(DataType.NOW)
  @Column({ type: DataType.DATE, allowNull: false })
  declare created_at: Date;
}
