export interface ILoginRequest {
  login: string;
  password: string;
  exten?: string;
}

export interface ILoginResponse {
  accessToken: string;
  user: {
    uniqueid: number;
    login: string;
    name: string;
    /** 0 = SuperAdmin, 1 = Tenant Admin, 2 = Operator, 3 = Supervisor, 5 = ReadOnly */
    level: number;
    role: number;
    exten: string;
    vpbx_user_uid: number;
  };
}

export interface IApiResponse<T = any> {
  data: T;
  message?: string;
}

export interface IApiError {
  statusCode: number;
  message: string;
  error?: string;
}

export interface IPaginatedResponse<T> {
  rows: T[];
  count: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

export interface IPaginationParams {
  page?: number;
  pageSize?: number;
  sortBy?: string;
  sortOrder?: 'ASC' | 'DESC';
  search?: string;
}
