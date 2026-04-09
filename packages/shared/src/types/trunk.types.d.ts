import { TrunkType } from '../enums';
export interface ITrunk {
    uid: number;
    name: string;
    type: TrunkType;
    description: string;
    host: string;
    username: string;
    secret: string;
    context: string;
    transport: string;
    reg_string: string;
    custom_data: string;
    user_uid: number;
}
export interface ICreateTrunk {
    name: string;
    type: TrunkType;
    description?: string;
    host: string;
    username?: string;
    secret?: string;
    context?: string;
    transport?: string;
    reg_string?: string;
    custom_data?: string;
}
export interface IUpdateTrunk extends Partial<ICreateTrunk> {
}
//# sourceMappingURL=trunk.types.d.ts.map