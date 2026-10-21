import type { IAutodialSchedule } from '@krasterisk/shared';
import { nextAutodialWindow } from './autodial-next-window.util';

const row = (overrides: Partial<IAutodialSchedule> = {}): IAutodialSchedule => ({ uid: 1, campaign_uid: 1, kind: 'weekly', weekday: 1,
  time_from: '09:00', time_to: '18:00', timezone: 'UTC', date_from: null, date_to: null, enabled: true, ...overrides });
describe('next allowed dialling window', () => {
  it('keeps a one-off window on one start date, including its overnight tail', () => {
    const schedules = [row({ kind: 'one_off', date_from: '2026-10-19', date_to: null, time_from: '22:00', time_to: '02:00' })];
    expect(nextAutodialWindow(schedules, new Date('2026-10-18T00:00:00Z'))?.toISOString()).toBe('2026-10-19T22:00:00.000Z');
    expect(nextAutodialWindow(schedules, new Date('2026-10-20T01:00:00Z'))?.toISOString()).toBe('2026-10-20T01:00:00.000Z');
    expect(nextAutodialWindow(schedules, new Date('2026-10-20T03:00:00Z'))).toBeNull();
  });
  it('preserves the exact instant when already open and distinguishes disabled from 24/7', () => {
    const now = new Date('2026-10-19T10:15:30Z');
    expect(nextAutodialWindow([], now)).toEqual(now);
    expect(nextAutodialWindow([row()], now)).toEqual(now);
    expect(nextAutodialWindow([row({ enabled: false })], now)).toBeNull();
  });
  it('finds the next weekly opening and honours a future date boundary without scanning every minute', () => {
    expect(nextAutodialWindow([row()], new Date('2026-10-19T18:00:00Z'))?.toISOString()).toBe('2026-10-26T09:00:00.000Z');
    expect(nextAutodialWindow([row({ kind: 'date_range', date_from: '2027-06-01', date_to: '2027-06-01' })], new Date('2026-10-19T00:00:00Z'))?.toISOString()).toBe('2027-06-01T09:00:00.000Z');
  });
  it('handles an overnight window and returns no next start after its final day', () => {
    const schedules = [row({ time_from: '22:00', time_to: '02:00', date_to: '2026-10-19' })];
    const night = new Date('2026-10-20T01:00:00Z');
    expect(nextAutodialWindow(schedules, night)).toEqual(night);
    expect(nextAutodialWindow(schedules, new Date('2026-10-20T02:00:00Z'))).toBeNull();
  });
  it('opens at the spring transition if a start time is missing, without inventing a shifted start', () => {
    const schedules = [row({ weekday: 0, time_from: '02:30', time_to: '04:00', timezone: 'Europe/Berlin' })];
    expect(nextAutodialWindow(schedules, new Date('2026-03-29T00:00:00Z'))?.toISOString()).toBe('2026-03-29T01:00:00.000Z');
  });
  it('finds a later week if the entire next weekly window falls inside a missing spring hour', () => {
    const schedules = [row({ weekday: 0, time_from: '02:00', time_to: '02:30', timezone: 'Europe/Berlin' })];
    expect(nextAutodialWindow(schedules, new Date('2026-03-22T03:00:00Z'))?.toISOString()).toBe('2026-04-05T00:00:00.000Z');
  });
  it('finds the second occurrence of an autumn window after its first occurrence has closed', () => {
    const schedules = [row({ weekday: 0, time_from: '02:30', time_to: '02:45', timezone: 'Europe/Berlin' })];
    expect(nextAutodialWindow(schedules, new Date('2026-10-25T00:50:00Z'))?.toISOString()).toBe('2026-10-25T01:30:00.000Z');
  });
  it('intersects the campaign IANA window with the subscriber fixed-offset window', () => {
    expect(nextAutodialWindow([row()], new Date('2026-10-19T00:00:00Z'), -180)?.toISOString()).toBe('2026-10-19T12:00:00.000Z');
    expect(nextAutodialWindow([row({ time_to: '10:00' })], new Date('2026-10-19T00:00:00Z'), -180)).toBeNull();
  });
  it('looks beyond the next week when the clocks overlap only after a later DST change', () => {
    const schedules = [row({ time_to: '10:00', timezone: 'Europe/Berlin' })];
    expect(nextAutodialWindow(schedules, new Date('2026-07-06T00:00:00Z'), 60)?.toISOString()).toBe('2026-10-26T08:00:00.000Z');
    expect(nextAutodialWindow([row({ ...schedules[0], date_to: '2026-07-31' })], new Date('2026-07-06T00:00:00Z'), 60)).toBeNull();
  });
});
