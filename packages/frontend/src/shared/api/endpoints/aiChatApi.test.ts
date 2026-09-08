import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, it, expect } from 'vitest';

describe('aiChatApi thread contract', () => {
  it('no longer exports a message-shaped thread detail', () => {
    const src = readFileSync(join(process.cwd(), 'src/shared/api/endpoints/aiChatApi.ts'), 'utf8');
    expect(src).toMatch(/timeline: AgentTimelineItem\[\]/);
    expect(src).not.toMatch(/IAiChatThreadMessage/);
    expect(src).not.toMatch(/streamAiChatMessage/);
  });
});
