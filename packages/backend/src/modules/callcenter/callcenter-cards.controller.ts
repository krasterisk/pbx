import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  Query,
  Req,
  UseGuards,
  ParseIntPipe,
  ForbiddenException,
} from '@nestjs/common';
import { Request } from 'express';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CallCenterCardsService } from './callcenter-cards.service';
import {
  CreateCardTemplateDto,
  UpdateCardTemplateDto,
  SaveCardDto,
  UpdateCardDto,
} from './dto/callcenter-cards.dto';

const SUPERVISOR_LEVEL = 3;

function assertSupervisor(user: any): void {
  if (user.level < SUPERVISOR_LEVEL) {
    throw new ForbiddenException('Supervisor access required (level >= 3)');
  }
}

@UseGuards(JwtAuthGuard)
@Controller('callcenter')
export class CallCenterCardsController {
  constructor(private readonly cardsService: CallCenterCardsService) {}

  @Get('card-templates')
  getCardTemplates(@Req() req: Request & { user: any }) {
    return this.cardsService.findTemplates(req.user.vpbx_user_uid);
  }

  @Get('card-templates/:id')
  getCardTemplate(
    @Param('id', ParseIntPipe) id: number,
    @Req() req: Request & { user: any },
  ) {
    return this.cardsService.findTemplate(id, req.user.vpbx_user_uid);
  }

  @Post('card-templates')
  createCardTemplate(
    @Body() dto: CreateCardTemplateDto,
    @Req() req: Request & { user: any },
  ) {
    assertSupervisor(req.user);
    return this.cardsService.createTemplate(dto, req.user.vpbx_user_uid);
  }

  @Put('card-templates/:id')
  updateCardTemplate(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateCardTemplateDto,
    @Req() req: Request & { user: any },
  ) {
    assertSupervisor(req.user);
    return this.cardsService.updateTemplate(id, dto, req.user.vpbx_user_uid);
  }

  @Delete('card-templates/:id')
  removeCardTemplate(
    @Param('id', ParseIntPipe) id: number,
    @Req() req: Request & { user: any },
  ) {
    assertSupervisor(req.user);
    return this.cardsService.removeTemplate(id, req.user.vpbx_user_uid);
  }

  @Get('cards')
  getCards(
    @Query('call_uniqueid') callUniqueid: string | undefined,
    @Query('caller_id') callerId: string | undefined,
    @Query('status') status: string | undefined,
    @Req() req: Request & { user: any },
  ) {
    return this.cardsService.findCards(req.user.vpbx_user_uid, {
      call_uniqueid: callUniqueid,
      caller_id: callerId,
      status,
    });
  }

  @Get('cards/by-call/:uniqueid')
  getCardByCall(
    @Param('uniqueid') uniqueid: string,
    @Req() req: Request & { user: any },
  ) {
    return this.cardsService.findCardByCall(uniqueid, req.user.vpbx_user_uid);
  }

  @Get('cards/:id')
  getCard(
    @Param('id', ParseIntPipe) id: number,
    @Req() req: Request & { user: any },
  ) {
    return this.cardsService.findCard(id, req.user.vpbx_user_uid);
  }

  @Post('cards')
  saveCard(
    @Body() dto: SaveCardDto,
    @Req() req: Request & { user: any },
  ) {
    return this.cardsService.saveCard(dto, req.user.vpbx_user_uid, req.user.sub);
  }

  @Put('cards/:id')
  updateCard(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateCardDto,
    @Req() req: Request & { user: any },
  ) {
    return this.cardsService.updateCard(id, dto, req.user.vpbx_user_uid);
  }
}
