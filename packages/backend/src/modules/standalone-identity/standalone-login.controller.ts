import { Body, Controller, HttpCode, Post, UseGuards } from '@nestjs/common';
import { Throttle, ThrottlerGuard } from '@nestjs/throttler';
import { LoginDto } from '../auth/dto/auth.dto';
import { StandaloneLoginService } from './standalone-login.service';

@Controller('auth')
export class StandaloneLoginController {
  constructor(private readonly loginService: StandaloneLoginService) {}

  @Post('login')
  @HttpCode(200)
  @UseGuards(ThrottlerGuard)
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  login(@Body() dto: LoginDto) {
    return this.loginService.login(dto.login, dto.password);
  }
}
