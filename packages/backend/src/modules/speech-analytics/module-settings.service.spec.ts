import { UserLevel } from '../users/user.model';
import {
  ModuleSettingsService,
  applyModelDefaultsWrite,
  canEditModels,
  resolveModelSelectVisibility,
  type SaModuleSettingsState,
} from './module-settings.service';

describe('module-settings (D-19, D-38)', () => {
  const emptyAllow: string[] = [];
  const allow = ['stt-a', 'stt-b', 'score-a', 'insights-a'];

  describe('canEditModels', () => {
    it('allows SUPERADMIN always; SUPERVISOR never; ADMIN only with tenant right', () => {
      expect(canEditModels(UserLevel.SUPERADMIN, false)).toBe(true);
      expect(canEditModels(UserLevel.SUPERADMIN, true)).toBe(true);
      expect(canEditModels(UserLevel.SUPERVISOR, true)).toBe(false);
      expect(canEditModels(UserLevel.SUPERVISOR, false)).toBe(false);
      expect(canEditModels(UserLevel.ADMIN, false)).toBe(false);
      expect(canEditModels(UserLevel.ADMIN, true)).toBe(true);
      expect(canEditModels(UserLevel.OPERATOR, true)).toBe(false);
    });
  });

  describe('applyModelDefaultsWrite', () => {
    it('preserves existing defaults when right is off; does not clear on right toggle off', () => {
      const existing: SaModuleSettingsState = {
        pauseNew: false,
        sttModelId: 'stt-a',
        scoreModelId: 'score-a',
        insightsModelId: 'insights-a',
        cabinetCanEditModels: true,
        modelAllowlist: allow,
      };
      const denied = applyModelDefaultsWrite(existing, {
        sttModelId: 'stt-b',
        scoreModelId: 'score-a',
        insightsModelId: 'insights-a',
      }, { level: UserLevel.ADMIN, cabinetCanEditModels: false });
      expect(denied.sttModelId).toBe('stt-a');
      expect(denied.scoreModelId).toBe('score-a');

      const rightOff = applyModelDefaultsWrite(
        { ...existing, cabinetCanEditModels: false },
        { cabinetCanEditModels: false },
        { level: UserLevel.SUPERADMIN, cabinetCanEditModels: false },
      );
      expect(rightOff.sttModelId).toBe('stt-a');
      expect(rightOff.cabinetCanEditModels).toBe(false);
    });

    it('lets SUPERADMIN and entitled ADMIN update module defaults within allowlist', () => {
      const base: SaModuleSettingsState = {
        pauseNew: false,
        sttModelId: null,
        scoreModelId: null,
        insightsModelId: null,
        cabinetCanEditModels: true,
        modelAllowlist: allow,
      };
      const next = applyModelDefaultsWrite(base, { sttModelId: 'stt-b', scoreModelId: 'score-a' }, {
        level: UserLevel.ADMIN,
        cabinetCanEditModels: true,
      });
      expect(next.sttModelId).toBe('stt-b');
      expect(next.scoreModelId).toBe('score-a');
    });
  });

  describe('resolveModelSelectVisibility', () => {
    it('hides model selects when allowlist empty or right off; pause stays available', () => {
      expect(resolveModelSelectVisibility({
        canEditModels: true,
        modelAllowlist: emptyAllow,
      })).toEqual({ showModelSelects: false, showPauseSwitch: true });
      expect(resolveModelSelectVisibility({
        canEditModels: false,
        modelAllowlist: allow,
      })).toEqual({ showModelSelects: false, showPauseSwitch: true });
      expect(resolveModelSelectVisibility({
        canEditModels: true,
        modelAllowlist: allow,
      })).toEqual({ showModelSelects: true, showPauseSwitch: true });
    });
  });

  describe('ModuleSettingsService', () => {
    it('persists pauseNew and model defaults with D-38 rights', () => {
      const svc = new ModuleSettingsService();
      const tenantUid = 42;
      svc.seed(tenantUid, {
        pauseNew: false,
        sttModelId: 'stt-a',
        scoreModelId: null,
        insightsModelId: null,
        cabinetCanEditModels: false,
        modelAllowlist: allow,
      });

      const paused = svc.setPauseNew(tenantUid, true, { level: UserLevel.ADMIN });
      expect(paused.pauseNew).toBe(true);

      const blocked = svc.setModelDefaults(tenantUid, { sttModelId: 'stt-b' }, {
        level: UserLevel.ADMIN,
      });
      expect(blocked.sttModelId).toBe('stt-a');

      svc.setCabinetCanEditModels(tenantUid, true, { level: UserLevel.SUPERADMIN });
      const updated = svc.setModelDefaults(tenantUid, { sttModelId: 'stt-b' }, {
        level: UserLevel.ADMIN,
      });
      expect(updated.sttModelId).toBe('stt-b');

      svc.setCabinetCanEditModels(tenantUid, false, { level: UserLevel.SUPERADMIN });
      const afterRightOff = svc.get(tenantUid);
      expect(afterRightOff.cabinetCanEditModels).toBe(false);
      expect(afterRightOff.sttModelId).toBe('stt-b');
    });
  });
});
