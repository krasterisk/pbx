import {
  Table, Column, Model, DataType,
  PrimaryKey, AutoIncrement, Default,
  ForeignKey, BelongsTo,
} from 'sequelize-typescript';
import { VoiceRobot } from './voice-robot.model';

/**
 * Column definition for a data list.
 * Each column has a key (field name), label (display name),
 * and a searchable flag (whether it participates in embedding search).
 */
export interface IDataListColumn {
  /** Field key used in row objects (e.g. "fio", "district", "phone") */
  key: string;
  /** Human-readable column label (e.g. "ФИО", "Район", "Телефон") */
  label: string;
  /** Whether this column is included in search text for embeddings */
  searchable: boolean;
}

/**
 * Voice Robot Data List — a small structured lookup table.
 *
 * Stores reference data (managers, districts, tariffs, etc.) as structured
 * JSON rows with named columns. Used by DataListSearchService for
 * hybrid fuzzy/embedding search during voice robot sessions.
 *
 * Design decision: One table for ALL data lists across all robots,
 * with tenant isolation via user_uid. This avoids creating separate
 * DB tables for each small reference dataset.
 */
@Table({
  tableName: 'voice_robot_data_lists',
  timestamps: true,
  freezeTableName: true,
  createdAt: 'created_at',
  updatedAt: 'updated_at',
})
export class VoiceRobotDataList extends Model {
  @PrimaryKey
  @AutoIncrement
  @Column({ type: DataType.INTEGER })
  declare uid: number;

  @ForeignKey(() => VoiceRobot)
  @Column({ type: DataType.INTEGER, allowNull: false })
  declare robot_id: number;

  @BelongsTo(() => VoiceRobot, { onDelete: 'CASCADE' })
  declare robot: VoiceRobot;

  /** Display name of the data list (e.g. "Менеджеры", "Районы") */
  @Column({ type: DataType.STRING(255), allowNull: false })
  declare name: string;

  /** Optional description */
  @Column({ type: DataType.TEXT, allowNull: true })
  declare description: string | null;

  /** Column schema: array of { key, label, searchable } */
  @Column({ type: DataType.JSON, allowNull: false })
  declare columns: IDataListColumn[];

  /** Structured data rows: array of { [columnKey]: value } */
  @Column({ type: DataType.JSON, allowNull: false })
  declare rows: Record<string, string>[];

  @Default(0)
  @Column({ type: DataType.INTEGER, allowNull: false })
  declare user_uid: number;

  declare created_at: Date;
  declare updated_at: Date;
}
