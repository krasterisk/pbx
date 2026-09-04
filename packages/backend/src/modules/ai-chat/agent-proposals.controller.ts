import { Controller, Get, Param, Post, Req, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { PbxAgentDiffService, type ProposalContext } from './pbx-agent-diff.service';

function contextFromToken(req: { user?: any }): ProposalContext {
  const user = req.user ?? {};
  return {
    vpbxUserUid: user.vpbx_user_uid,
    userUid: user.sub || user.id || 0,
    role: user.level,
  };
}

@ApiTags('AI Chat')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('ai-chat/proposals')
export class AgentProposalsController {
  constructor(private readonly diffService: PbxAgentDiffService) {}

  @ApiOperation({ summary: 'List pending agent proposals for the caller' })
  @Get('pending')
  getPending(@Req() req: any) {
    return this.diffService.getPending(contextFromToken(req));
  }

  @ApiOperation({ summary: 'Apply a pending proposal by identifier' })
  @Throttle({ global: { limit: 10, ttl: 60000 } })
  @Post(':proposalId/apply')
  apply(@Param('proposalId') proposalId: string, @Req() req: any) {
    return this.diffService.apply(proposalId, contextFromToken(req));
  }

  @ApiOperation({ summary: 'Reject a pending proposal by identifier' })
  @Throttle({ global: { limit: 10, ttl: 60000 } })
  @Post(':proposalId/reject')
  reject(@Param('proposalId') proposalId: string, @Req() req: any) {
    return this.diffService.reject(proposalId, contextFromToken(req));
  }
}
