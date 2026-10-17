import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/sequelize';
import { AgentProposal } from './models/agent-proposal.model';
import { AgentWorkflow, AgentWorkflowStep } from './models/agent-workflow.model';
import { InteractiveSessionService } from '../auth/interactive-session.service';

/** Restrict only autodial changes; other modules retain their existing confirmation contract. */
@Injectable()
export class AutodialInteractiveGuard implements CanActivate {
  constructor(@InjectModel(AgentProposal) private readonly proposals: typeof AgentProposal,
    @InjectModel(AgentWorkflow) private readonly workflows: typeof AgentWorkflow,
    @InjectModel(AgentWorkflowStep) private readonly steps: typeof AgentWorkflowStep,
    private readonly interactive: InteractiveSessionService) {}
  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest();
    const where = { vpbx_user_uid: req.user?.vpbx_user_uid, user_uid: req.user?.sub };
    if (req.params.proposalId) {
      const proposal = await this.proposals.findOne({ where: { ...where, proposal_id: req.params.proposalId } });
      if (String(proposal?.apply_payload?.tool ?? '').includes('_autodial_')) this.interactive.assert(req);
    } else if (req.params.workflowId) {
      const workflow = await this.workflows.findOne({ where: { ...where, workflow_id: req.params.workflowId } });
      if (workflow) {
        const steps = await this.steps.findAll({ where: { workflow_uid: workflow.uid }, attributes: ['tool'] });
        if (steps.some((step) => step.tool.includes('_autodial_'))) this.interactive.assert(req);
      }
    }
    return true;
  }
}
