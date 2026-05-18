import { describe, it, expect } from 'vitest';
import { ensureCdrVpbxUserUidInDialplan } from '@krasterisk/shared';

describe('ensureCdrVpbxUserUidInDialplan', () => {
  it('replaces wrong tenant id in Set(CDR(vpbx_user_uid)=…)', () => {
    const input = [
      'exten => 100,1,NoOp()',
      'same => n,Set(CDR(vpbx_user_uid)=99)',
      'same => n,Hangup()',
    ].join('\n');
    expect(ensureCdrVpbxUserUidInDialplan(input, 0)).toContain('Set(CDR(vpbx_user_uid)=0)');
    expect(ensureCdrVpbxUserUidInDialplan(input, 0)).not.toContain('=99');
  });

  it('inserts Set line after exten priority 1 when missing', () => {
    const input = [
      'exten => _X.,1,NoOp()',
      'same => n,Dial(PJSIP/${EXTEN},30)',
    ].join('\n');
    const out = ensureCdrVpbxUserUidInDialplan(input, 42);
    expect(out).toContain('Set(CDR(vpbx_user_uid)=42)');
    const lines = out.split('\n');
    expect(lines[1]).toContain('Set(CDR(vpbx_user_uid)=42)');
  });

  it('does not duplicate when already correct', () => {
    const input = [
      'exten => 100,1,NoOp()',
      'same => n,Set(CDR(vpbx_user_uid)=0)',
      'same => n,Hangup()',
    ].join('\n');
    const out = ensureCdrVpbxUserUidInDialplan(input, 0);
    expect(out.match(/CDR\(vpbx_user_uid\)/gi)?.length).toBe(1);
  });
});
