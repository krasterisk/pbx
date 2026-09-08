import { Controller, Get, Param, Post, Req, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import type { ProposalContext } from './pbx-agent-diff.service';
import { PbxWorkflowRunnerService } from './pbx-workflow-runner.service';

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
@Controller('ai-chat/workflows')
export class AgentWorkflowsController {
  constructor(private readonly workflows: PbxWorkflowRunnerService) {}

  @ApiOperation({ summary: 'List pending/failed agent workflows for the caller' })
  @Get('pending')
  getPending(@Req() req: any) {
    return this.workflows.listPending(contextFromToken(req));
  }

  @ApiOperation({ summary: 'Get one workflow plan with live step statuses' })
  @Get(':workflowId')
  getOne(@Param('workflowId') workflowId: string, @Req() req: any) {
    return this.workflows.getOwned(workflowId, contextFromToken(req));
  }

  @ApiOperation({ summary: 'Apply a staged workflow (stops on first failure)' })
  @Throttle({ global: { limit: 10, ttl: 60000 } })
  @Post(':workflowId/apply')
  apply(@Param('workflowId') workflowId: string, @Req() req: any) {
    return this.workflows.apply(workflowId, contextFromToken(req));
  }

  @ApiOperation({ summary: 'Reject a pending workflow' })
  @Throttle({ global: { limit: 10, ttl: 60000 } })
  @Post(':workflowId/reject')
  reject(@Param('workflowId') workflowId: string, @Req() req: any) {
    return this.workflows.reject(workflowId, contextFromToken(req));
  }
}
