import { test as base } from './auth.fixture';
import { startLlmStub, type LlmStubHandle } from '../llm-stub';

export type { LlmStubHandle };

function llmStubPort(workerIndex: number): number {
  const raw = process.env.HARNESS_LLM_STUB_PORT;
  const parsed = Number(raw);
  const base = raw !== undefined && raw !== '' && Number.isFinite(parsed) ? parsed : 5099;
  return base + workerIndex;
}

export const test = base.extend<{ llmStub: LlmStubHandle }>({
  llmStub: [async ({}, use, workerInfo) => {
    const handle = await startLlmStub({ port: llmStubPort(workerInfo.workerIndex) });
    await use(handle);
    await handle.close();
  }, { scope: 'worker' }],
});

export { expect } from '@playwright/test';
