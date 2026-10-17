const { assertLockstep } = require('../../shared/app-version.cjs') as {
  assertLockstep: () => { version: string; npmVersion: string };
};

describe('application version lockstep', () => {
  it('keeps workspace manifests on the application version', () => {
    const app = assertLockstep();
    expect(app.version).toMatch(/^4\.\d+\.\d+\.\d+$/);
    expect(app.npmVersion).toBe(app.version.split('.').slice(0, 3).join('.'));
  });
});
