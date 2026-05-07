import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsEmail, IsNotEmpty, IsOptional, IsString,
  MaxLength, MinLength,
} from 'class-validator';

export class LoginDto {
  @ApiProperty({ example: 'admin@company.ru', description: 'Логин пользователя' })
  @IsNotEmpty()
  @IsString()
  @MaxLength(255)
  login!: string;

  @ApiProperty({ example: '••••••••', description: 'Пароль' })
  @IsNotEmpty()
  @IsString()
  @MinLength(1)
  password!: string;
}

export class RegisterDto {
  @ApiProperty({ example: 'admin@company.ru', description: 'Логин (email)' })
  @IsNotEmpty()
  @IsString()
  @MaxLength(255)
  login!: string;

  @ApiProperty({ example: '••••••••', description: 'Пароль, минимум 8 символов' })
  @IsNotEmpty()
  @IsString()
  @MinLength(8)
  @MaxLength(128)
  password!: string;

  @ApiProperty({ example: 'Иванов Иван', description: 'Отображаемое имя' })
  @IsNotEmpty()
  @IsString()
  @MaxLength(255)
  name!: string;

  @ApiPropertyOptional({ example: 'admin@company.ru', description: 'Email для активации' })
  @IsOptional()
  @IsEmail()
  email?: string;
}

export class ActivationDto {
  @ApiProperty({ description: 'Логин пользователя' })
  @IsNotEmpty()
  @IsString()
  login!: string;

  @ApiProperty({ example: '123456', description: '6-значный код из письма' })
  @IsNotEmpty()
  @IsString()
  code!: string;
}

export class RefreshDto {
  @ApiProperty({ description: 'Refresh-токен для обновления сессии' })
  @IsNotEmpty()
  @IsString()
  refreshToken!: string;
}

export class LogoutDto {
  @ApiProperty({ description: 'Refresh-токен текущей сессии' })
  @IsNotEmpty()
  @IsString()
  refreshToken!: string;
}
