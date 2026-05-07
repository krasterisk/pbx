import {
  Table, Column, Model, DataType,
  PrimaryKey, AutoIncrement, Default, AllowNull, Unique,
} from 'sequelize-typescript';

export type ModuleCategory = 'pbx' | 'calls' | 'analytics' | 'integrations' | 'admin';

@Table({ tableName: 'modules_registry', timestamps: false, createdAt: 'created_at', updatedAt: false })
export class ModuleRegistry extends Model {
  @PrimaryKey
  @AutoIncrement
  @Column(DataType.INTEGER)
  declare id: number;

  /** Уникальный код модуля — используется как ключ во всей системе */
  @Unique
  @AllowNull(false)
  @Column(DataType.STRING(64))
  declare code: string;

  @AllowNull(false)
  @Column(DataType.STRING(128))
  declare name: string;

  @AllowNull(true)
  @Column(DataType.TEXT)
  declare description: string | null;

  @Default('1.0.0')
  @Column(DataType.STRING(16))
  declare version: string;

  @Default('pbx')
  @Column(DataType.ENUM('pbx', 'calls', 'analytics', 'integrations', 'admin'))
  declare category: ModuleCategory;

  /** Базовый модуль — нельзя отключить */
  @Default(false)
  @Column(DataType.BOOLEAN)
  declare is_core: boolean;

  @Default(false)
  @Column(DataType.BOOLEAN)
  declare is_paid: boolean;

  /** Цена в рублях (0 = бесплатно). Для хранения используем DECIMAL */
  @Default(0)
  @Column(DataType.DECIMAL(10, 2))
  declare price_monthly: number;

  @Default(true)
  @Column(DataType.BOOLEAN)
  declare is_published: boolean;

  /** Только для CLOUD-режима */
  @Default(false)
  @Column(DataType.BOOLEAN)
  declare requires_cloud: boolean;

  /** JSON-массив кодов зависимых модулей */
  @Default('[]')
  @Column(DataType.JSON)
  declare dependencies: string[];

  @Default(DataType.NOW)
  @Column(DataType.DATE)
  declare created_at: Date;
}
