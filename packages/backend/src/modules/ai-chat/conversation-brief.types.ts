/**
 * Persisted conversation brief: source-evidenced facts the agent must retain
 * across turns without replaying the entire chat history.
 */

export interface BriefFact {
  /** Stable key, e.g. `ivr.name`, `group.members`, `greeting.text`. */
  key: string;
  value: string;
  /** Message uid that introduced or last replaced this fact. */
  sourceMessageUid: number;
  /** Short quote from that message proving the value. */
  sourceQuote: string;
}

export interface ConversationBrief {
  /** First substantive user message, kept verbatim for the life of the thread. */
  anchor: string;
  anchorMessageUid: number;
  goal: string | null;
  facts: BriefFact[];
  /** Explicit replacements the user stated later (old → new), with evidence. */
  replacements: Array<{
    key: string;
    from: string;
    to: string;
    sourceMessageUid: number;
    sourceQuote: string;
  }>;
  missingFacts: string[];
  workflowProgress: {
    status: 'idle' | 'planning' | 'awaiting_confirm' | 'applying' | 'complete';
    lastSummary?: string;
    activeWorkflowUid?: number | null;
  };
  version: number;
  updatedThroughMessageUid: number;
}

export function emptyBrief(): ConversationBrief {
  return {
    anchor: '',
    anchorMessageUid: 0,
    goal: null,
    facts: [],
    replacements: [],
    missingFacts: [],
    workflowProgress: { status: 'idle' },
    version: 0,
    updatedThroughMessageUid: 0,
  };
}

export function renderBriefForPrompt(brief: ConversationBrief): string {
  if (!brief.anchor && brief.facts.length === 0) return '';
  const lines: string[] = ['Pinned conversation brief (authoritative; do not re-ask covered facts):'];
  if (brief.anchor) {
    lines.push(`Anchor (verbatim first request): ${brief.anchor}`);
  }
  if (brief.goal) {
    lines.push(`Goal: ${brief.goal}`);
  }
  if (brief.facts.length) {
    lines.push('Facts:');
    for (const fact of brief.facts) {
      lines.push(`- ${fact.key}=${fact.value} (msg#${fact.sourceMessageUid}: "${fact.sourceQuote}")`);
    }
  }
  if (brief.replacements.length) {
    lines.push('Replacements:');
    for (const rep of brief.replacements) {
      lines.push(`- ${rep.key}: ${rep.from} → ${rep.to} (msg#${rep.sourceMessageUid})`);
    }
  }
  if (brief.missingFacts.length) {
    lines.push(`Missing: ${brief.missingFacts.join(', ')}`);
  }
  if (brief.workflowProgress.status !== 'idle') {
    lines.push(
      `Workflow: ${brief.workflowProgress.status}` +
        (brief.workflowProgress.lastSummary ? ` — ${brief.workflowProgress.lastSummary}` : ''),
    );
  }
  return lines.join('\n');
}
