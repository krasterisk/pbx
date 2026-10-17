import { describe, expect, it } from 'vitest';

/**
 * Precondition: backend running locally or in CI (e.g. npm run dev:backend on :5010).
 * Set HARNESS_API_URL to override base URL (default http://localhost:5010).
 */
const apiBase = process.env.HARNESS_API_URL ?? 'http://localhost:5010';

describe('GET /api/health', () => {
  it('returns 200 with status ok', async () => {
    const response = await fetch(`${apiBase}/api/health`);

    expect(response.status).toBe(200);

    const body = (await response.json()) as {
      status: string; timestamp: string; version: string; sha: string; schema: string | null;
    };
    expect(body.status).toBe('ok');
    expect(body.timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T/);
    expect(body.version).toMatch(/^4\.\d+\.\d+\.\d+$/);
    expect(body.sha.length).toBeGreaterThan(0);
    expect(body).toHaveProperty('schema');
  });
});
