import { UserLevel } from '../enums';
export interface IUser {
    uniqueid: number;
    login: string;
    name: string;
    email: string;
    exten: string;
    level: UserLevel;
    role: number;
    numbers_id: number;
    permit_extens: string;
    listbook_edit: number;
    oper_chanspy: number;
    outbound_posttime: number;
    suspension_time: number;
    inactive_time: number;
    user_uid: number;
}
export interface IUserSafe extends Omit<IUser, 'passwd'> {
}
export interface ICreateUser {
    login: string;
    name: string;
    password: string;
    email?: string;
    exten?: string;
    level: UserLevel;
    role?: number;
}
export interface IUpdateUser {
    login?: string;
    name?: string;
    password?: string;
    email?: string;
    exten?: string;
    level?: UserLevel;
    role?: number;
    permit_extens?: string;
    numbers_id?: number;
    listbook_edit?: number;
    oper_chanspy?: number;
    outbound_posttime?: number;
    suspension_time?: number;
    inactive_time?: number;
}
//# sourceMappingURL=user.types.d.ts.map