import { Column, DataType, Model, Table } from 'sequelize-typescript';

/** Generated invoice for an AI usage period. PDF is stored in object storage. */
@Table({ tableName: 'cc_ai_invoices', timestamps: false })
export class CcAiInvoice extends Model {
  @Column({ primaryKey: true, autoIncrement: true, type: DataType.INTEGER })
  declare uid: number;

  @Column({ type: DataType.STRING(64), allowNull: false })
  declare invoice_number: string;

  @Column({ type: DataType.DATEONLY, allowNull: false })
  declare period_from: string;

  @Column({ type: DataType.DATEONLY, allowNull: false })
  declare period_to: string;

  @Column({ type: DataType.DECIMAL(14, 4), allowNull: false, defaultValue: 0 })
  declare total_amount: number;

  @Column({ type: DataType.STRING(8), allowNull: false, defaultValue: 'USD' })
  declare currency: string;

  @Column({
    type: DataType.ENUM('draft', 'issued', 'paid', 'void'),
    allowNull: false,
    defaultValue: 'draft',
  })
  declare status: 'draft' | 'issued' | 'paid' | 'void';

  @Column({ type: DataType.STRING(512), allowNull: true })
  declare pdf_ref: string;

  @Column({ type: DataType.DATE, allowNull: false, defaultValue: DataType.NOW })
  declare created_at: Date;

  @Column({ type: DataType.INTEGER, allowNull: false, defaultValue: 0, field: 'vpbx_user_uid' })
  declare user_uid: number;
}
