import { Body, Controller, Get, Param, ParseIntPipe, Post, Req, UseGuards, ValidationPipe } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { HelpdeskChatService } from './helpdesk-chat.service';
import { HelpdeskMessageDto } from './dto/helpdesk-chat.dto';

interface SupportRequest { user: { vpbx_user_uid: number; sub?: number; id?: number } }

@UseGuards(JwtAuthGuard)
@Controller('ai-chat/threads/:uid/helpdesk')
export class HelpdeskChatController {
  constructor(private readonly support: HelpdeskChatService) {}

  @Get()
  session(@Param('uid', ParseIntPipe) uid: number, @Req() req: SupportRequest) {
    return this.support.session(uid, Number(req.user.vpbx_user_uid), Number(req.user.sub ?? req.user.id));
  }

  @Post('message')
  message(@Param('uid', ParseIntPipe) uid: number, @Req() req: SupportRequest,
    @Body(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true })) body: HelpdeskMessageDto) {
    return this.support.session(uid, Number(req.user.vpbx_user_uid), Number(req.user.sub ?? req.user.id), body);
  }
}
