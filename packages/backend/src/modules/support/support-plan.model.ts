import { Column, DataType, Model, Table } from 'sequelize-typescript';
@Table({tableName:'support_plans',timestamps:false,freezeTableName:true})
export class SupportPlan extends Model {
  @Column({type:DataType.CHAR(64),primaryKey:true}) declare id:string;
  @Column({type:DataType.INTEGER,allowNull:false}) declare tenant_uid:number;
  @Column({type:DataType.CHAR(36),allowNull:false}) declare principal_id:string;
  @Column({type:DataType.STRING(24),allowNull:false}) declare permission_revision:string;
  @Column({type:DataType.CHAR(36),allowNull:true}) declare workflow_id:string|null;
  @Column({type:DataType.JSON,allowNull:false}) declare draft:Record<string,unknown>;
  @Column({type:DataType.JSON,allowNull:false}) declare view_json:Record<string,unknown>;
  @Column({type:DataType.CHAR(64),allowNull:false}) declare approval_hash:string;
  @Column({type:DataType.STRING(24),allowNull:false}) declare status:string;
  @Column({type:DataType.DATE,allowNull:false}) declare expires_at:Date;
  @Column({type:DataType.DATE,allowNull:false}) declare updated_at:Date;
}
