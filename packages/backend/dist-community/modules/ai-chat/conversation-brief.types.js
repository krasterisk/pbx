"use strict";
/**
 * Persisted conversation brief: source-evidenced facts the agent must retain
 * across turns without replaying the entire chat history.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.emptyBrief = emptyBrief;
exports.renderBriefForPrompt = renderBriefForPrompt;
function emptyBrief() {
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
function renderBriefForPrompt(brief) {
    if (!brief.anchor && brief.facts.length === 0)
        return '';
    const lines = ['Pinned conversation brief (authoritative; do not re-ask covered facts):'];
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
        lines.push(`Workflow: ${brief.workflowProgress.status}` +
            (brief.workflowProgress.lastSummary ? ` — ${brief.workflowProgress.lastSummary}` : ''));
    }
    return lines.join('\n');
}
//# sourceMappingURL=conversation-brief.types.js.map