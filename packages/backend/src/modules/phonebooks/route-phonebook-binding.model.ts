import { Table, Column, Model, DataType, PrimaryKey, AutoIncrement, ForeignKey, BelongsTo } from 'sequelize-typescript';
import { Route } from '../routes/route.model';
import { RoutePhonebook } from './phonebook.model';
import type { PhonebookMatchMode, PhonebookBehaviorType, IRouteAction } from '@krasterisk/shared';

/**
 * Route <-> Phonebook binding (D-05): connects a route to a phonebook with an
 * ordered policy (position, match_mode, behavior). One phonebook is reused
 * across many bindings, each with its own behavior on a different route (D-02).
 */
@Table({ tableName: 'route_phonebook_bindings', timestamps: false, freezeTableName: true })
export class RoutePhonebookBinding extends Model {
  @PrimaryKey
  @AutoIncrement
  @Column({ type: DataType.INTEGER })
  declare uid: number;

  @ForeignKey(() => Route)
  @Column({ type: DataType.INTEGER, allowNull: false })
  declare route_uid: number;

  @ForeignKey(() => RoutePhonebook)
  @Column({ type: DataType.INTEGER, allowNull: false })
  declare phonebook_uid: number;

  /** Order within the route's binding chain — lower runs first (D-03) */
  @Column({ type: DataType.INTEGER, allowNull: false, defaultValue: 0 })
  declare position: number;

  @Column({ type: DataType.STRING(16), allowNull: false, defaultValue: 'on_match' })
  declare match_mode: PhonebookMatchMode;

  @Column({ type: DataType.STRING(32), allowNull: false, defaultValue: 'vars_only' })
  declare behavior_type: PhonebookBehaviorType;

  @Column({ type: DataType.JSON, allowNull: true, defaultValue: null })
  declare behavior_params: Record<string, any> | null;

  /** Dialplan actions rendered when behavior_type = 'custom' */
  @Column({ type: DataType.JSON, allowNull: true, defaultValue: null })
  declare actions: IRouteAction[] | null;

  @Column({ type: DataType.INTEGER, allowNull: false, defaultValue: 0 })
  declare user_uid: number;

  @Column({ type: DataType.DATE, field: 'created_at' })
  declare created_at: Date;

  @Column({ type: DataType.DATE, field: 'updated_at' })
  declare updated_at: Date;

  @BelongsTo(() => Route, { foreignKey: 'route_uid', as: 'route' })
  declare route: Route;

  @BelongsTo(() => RoutePhonebook, { foreignKey: 'phonebook_uid', as: 'phonebook' })
  declare phonebook: RoutePhonebook;
}
