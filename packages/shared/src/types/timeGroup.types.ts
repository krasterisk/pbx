/**
 * A single time interval within a time group.
 * Maps to Asterisk GotoIfTime/ExecIfTime syntax: time,dow,dom,months
 */
export interface ITimeGroupInterval {
  /** Start time in HH:MM format, e.g. "09:00" */
  time_start: string;
  /** End time in HH:MM format, e.g. "18:00" */
  time_end: string;
  /** Days of week: "mon-fri" | "mon,wed,fri" | "*" (all) */
  days_of_week: string;
  /** Days of month: "1-15" | "12" | "*" (all) */
  days_of_month: string;
  /** Months: "jan-jun" | "jan" | "*" (all) */
  months: string;
}

export interface ITimeGroup {
  uid: number;
  name: string;
  comment?: string;
  intervals: ITimeGroupInterval[];
  user_uid: number;
  created_at?: string;
  updated_at?: string;
}
