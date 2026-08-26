import { DEFAULT_ARI_APP_NAME, resolveAriAppName } from './ari-app-name';

describe('resolveAriAppName', () => {
  const prev = process.env.ARI_APP_NAME;

  afterEach(() => {
    if (prev === undefined) delete process.env.ARI_APP_NAME;
    else process.env.ARI_APP_NAME = prev;
  });

  it('defaults when unset', () => {
    delete process.env.ARI_APP_NAME;
    expect(resolveAriAppName()).toBe(DEFAULT_ARI_APP_NAME);
  });

  it('uses explicit argument over env', () => {
    process.env.ARI_APP_NAME = 'from_env';
    expect(resolveAriAppName('krasterisk_robot_dev')).toBe('krasterisk_robot_dev');
  });

  it('strips illegal dialplan characters', () => {
    expect(resolveAriAppName('krasterisk,robot')).toBe('krasteriskrobot');
  });

  it('falls back when value is empty after sanitize', () => {
    expect(resolveAriAppName('   ')).toBe(DEFAULT_ARI_APP_NAME);
  });
});
