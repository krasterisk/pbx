import {
  Table, Column, Model, DataType, PrimaryKey, AutoIncrement,
  ForeignKey, BelongsTo, Default, AllowNull,
} from 'sequelize-typescript';
import { Route } from '../routes/route.model';
import { Directory } from './directory.model';
import type {
  CallValueSource,
  DirectoryBehaviorType,
  DirectoryMatchMode,
  IDirectoryBehaviorParams,
  IRouteAction,
} from '@krasterisk/shared';

@Table({
  tableName: 'route_directory_bindings',
  timestamps: false,
  freezeTableName: true,
  indexes: [
    { name: 'idx_rdb_user_uid', fields: ['user_uid'] },
  ],
})
export class RouteDirectoryBinding extends Model {
  @PrimaryKey
  @AutoIncrement
  @Column(DataType.INTEGER)
  declare uid: number;

  @ForeignKey(() => Route)
  @Column({ type: DataType.INTEGER, allowNull: false })
  declare route_uid: number;

  @ForeignKey(() => Directory)
  @Column({ type: DataType.INTEGER, allowNull: false })
  declare directory_uid: number;

  @Default(0)
  @Column({ type: DataType.INTEGER, allowNull: false })
  declare position: number;

  @Column({ type: DataType.JSON, allowNull: false })
  declare key_source: CallValueSource;

  @Default('on_match')
  @Column({ type: DataType.STRING(16), allowNull: false })
  declare match_mode: DirectoryMatchMode;

  @Column({ type: DataType.STRING(32), allowNull: false })
  declare behavior_type: DirectoryBehaviorType;

  @AllowNull(true)
  @Column({ type: DataType.JSON, defaultValue: null })
  declare behavior_params: IDirectoryBehaviorParams | null;

  @AllowNull(true)
  @Column({ type: DataType.JSON, defaultValue: null })
  declare actions: IRouteAction[] | null;

  @Column({ type: DataType.INTEGER, allowNull: false })
  declare user_uid: number;

  @BelongsTo(() => Route, { foreignKey: 'route_uid', as: 'route' })
  declare route: Route;

  @BelongsTo(() => Directory, { foreignKey: 'directory_uid', as: 'directory' })
  declare directory: Directory;
}
