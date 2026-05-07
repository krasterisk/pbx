import { ApiProperty } from '@nestjs/swagger';

/** Данные пользователя, возвращаемые в auth-ответах (без пароля) */
export class AuthUserPayload {
  @ApiProperty() uniqueid!: number;
  @ApiProperty() login!: string;
  @ApiProperty() name!: string;
  @ApiProperty() level!: number;
  @ApiProperty() role!: number;
  @ApiProperty() exten!: string;
  @ApiProperty() vpbx_user_uid!: number;
}

export class AuthTokenResponse {
  @ApiProperty() accessToken!: string;
  @ApiProperty() refreshToken!: string;
  @ApiProperty({ type: AuthUserPayload }) user!: AuthUserPayload;
}

export class MessageResponse {
  @ApiProperty() success!: boolean;
  @ApiProperty() message!: string;
}
