import { Column, DataType, Model, Table } from 'sequelize-typescript';

/**
 * Field definition within a call card template (D-11).
 *
 * v1 field types (14): text, textarea, phone, email, select, multi_select, date,
 * datetime, number, checkbox, phonebook_lookup, divider, heading, readonly.
 *
 * 'file' upload is intentionally excluded from v1 — requires storage/limits evaluation.
 */
@Table({ tableName: 'cc_card_fields', timestamps: false })
export class CcCardField extends Model {
  @Column({ primaryKey: true, autoIncrement: true, type: DataType.INTEGER })
  declare uid: number;

  @Column({ type: DataType.INTEGER, allowNull: false })
  declare template_id: number;

  @Column({ type: DataType.STRING(64), allowNull: false })
  declare field_key: string;

  @Column({
    type: DataType.ENUM(
      'text',
      'textarea',
      'phone',
      'email',
      'select',
      'multi_select',
      'date',
      'datetime',
      'number',
      'checkbox',
      'phonebook_lookup',
      'divider',
      'heading',
      'readonly',
    ),
    allowNull: false,
  })
  declare field_type: string;

  @Column({ type: DataType.STRING(128), allowNull: false })
  declare label: string;

  @Column({ type: DataType.STRING(256), allowNull: true, defaultValue: '' })
  declare placeholder: string;

  @Column({ type: DataType.BOOLEAN, allowNull: false, defaultValue: false })
  declare is_required: boolean;

  @Column({ type: DataType.STRING(256), allowNull: true, defaultValue: '' })
  declare default_value: string;

  /** Options for select / multi_select fields. */
  @Column({ type: DataType.JSON, allowNull: true })
  declare options: unknown[] | null;

  /** Parent field_key for dependent fields. */
  @Column({ type: DataType.STRING(64), allowNull: true })
  declare depends_on: string | null;

  @Column({ type: DataType.JSON, allowNull: true })
  declare depends_values: unknown[] | null;

  @Column({ type: DataType.INTEGER, allowNull: false, defaultValue: 0 })
  declare sort_order: number;

  @Column({
    type: DataType.ENUM('full', 'half'),
    allowNull: false,
    defaultValue: 'full',
  })
  declare width: 'full' | 'half';

  /** Auto-populate source: phonebook.name, caller_id, queue, etc. */
  @Column({ type: DataType.STRING(64), allowNull: true })
  declare auto_populate: string | null;

  @Column({ type: DataType.INTEGER, allowNull: false, defaultValue: 0, field: 'vpbx_user_uid' })
  declare user_uid: number;
}
