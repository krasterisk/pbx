import { describe, it, expect } from 'vitest';
import { hubPageLabelKey } from './hubPageLabel';

describe('hubPageLabelKey', () => {
  it('maps catalog page codes to sidebar i18n keys', () => {
    expect(hubPageLabelKey({ page_code: 'endpoints', path: '/endpoints' })).toBe('endpoints.title');
    expect(hubPageLabelKey({ page_code: 'contexts', path: '/contexts' })).toBe('contexts.title');
    expect(hubPageLabelKey({ page_code: 'trunks', path: '/trunks' })).toBe('nav.trunks');
    expect(hubPageLabelKey({ page_code: 'time_groups', path: '/time-groups' })).toBe('nav.timeGroups');
    expect(hubPageLabelKey({ page_code: 'directories', path: '/directories' })).toBe('nav.directories');
    expect(hubPageLabelKey({ page_code: 'phonebooks' })).toBe('phonebooks.title');
    expect(hubPageLabelKey({ page_code: 'provision', path: '/provision-templates' })).toBe('nav.provisionTemplates');
    expect(hubPageLabelKey({ page_code: 'ivr', path: '/ivrs' })).toBe('nav.ivrs');
    expect(hubPageLabelKey({ page_code: 'prompts', path: '/prompts' })).toBe('promptsPage.title');
    expect(hubPageLabelKey({ page_code: 'moh', path: '/moh' })).toBe('moh.title');
    expect(hubPageLabelKey({ page_code: 'voice_robot', path: '/voice-robots' })).toBe('nav.voiceRobots');
    expect(hubPageLabelKey({ page_code: 'call_groups', path: '/call-groups' })).toBe('nav.callGroups');
    expect(hubPageLabelKey({ page_code: 'users_roles', path: '/users' })).toBe('nav.users');
    expect(hubPageLabelKey({ page_code: 'tts_engines', path: '/settings/tts-engines' })).toBe('nav.ttsEngines');
    expect(hubPageLabelKey({ page_code: 'audit_log', path: '/audit-log' })).toBe('nav.auditLog');
    expect(hubPageLabelKey({ page_code: 'tenant_modules', path: '/my-modules' })).toBe('nav.modules');
  });
});
