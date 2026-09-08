import { test as base } from '@playwright/test';
import { startLlmStub, type LlmStubHandle } from '../llm-stub';

export type { LlmStubHandle };

export const test = base.extend<{ llmStub: LlmStubHandle }>({
  llmStub: [async ({}, use) => {
    const port = Number(process.env.HARNESS_LLM_STUB_PORT || 5099);
    const handle = await startLlmStub({ port });
    await use(handle);
    await handle.close();
  }, { scope: 'worker' }],
});

export { expect } from '@playwright/test';
