import { AiAgentsModule } from '../modules/ai-agents/ai-agents.module';
import { CcAiAgent } from '../modules/ai-agents/models/ai-agent.model';
import { CcAiToolset } from '../modules/ai-agents/models/ai-toolset.model';
import { CcAiCdr } from '../modules/ai-agents/models/ai-cdr.model';
import { CcAiBilling } from '../modules/ai-agents/models/ai-billing.model';
import { CcAiInvoice } from '../modules/ai-agents/models/ai-invoice.model';

/** New commercial AI product runtime. Community-pbx must not import this file. */
export const COMMERCIAL_AI_NEST_MODULES = [AiAgentsModule] as const;
export const COMMERCIAL_AI_MODELS = [
  CcAiAgent, CcAiToolset, CcAiCdr, CcAiBilling, CcAiInvoice,
] as const;
