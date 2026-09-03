import {
  BadRequestException,
  Controller,
  Get,
  Param,
  Req,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { isActionReferenceKind } from './action-reference.util';
import { RouteReferencesService } from './route-references.service';

@Controller('route-references')
@UseGuards(JwtAuthGuard)
export class RouteReferencesController {
  constructor(private readonly routeReferencesService: RouteReferencesService) {}

  @Get(':kind/:uid')
  async getUsage(
    @Param('kind') kind: string,
    @Param('uid') uid: string,
    @Req() req: { user?: { vpbx_user_uid?: number } },
  ) {
    if (!isActionReferenceKind(kind)) {
      throw new BadRequestException('Invalid reference kind');
    }
    const vpbxUserUid = req.user?.vpbx_user_uid;
    if (vpbxUserUid == null) {
      throw new BadRequestException('Missing tenant scope');
    }
    const parsedUid = /^\d+$/.test(uid) ? Number(uid) : uid;
    return this.routeReferencesService.findUsage(kind, parsedUid, vpbxUserUid);
  }
}
