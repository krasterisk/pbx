export interface IMohEntry {
  filename: string;
  position: number;
  entry?: string; // absolute path on Asterisk server (read-only, set by backend)
}

export interface IMohClass {
  name: string;           // moh_{uid}_{slug} — Asterisk class name (PK)
  displayName: string;    // human-readable name derived from class name
  mode: string;
  sort: 'alpha' | 'random' | 'randstart';
  directory: string;
  user_uid: number;
  entries: IMohEntry[];
}

export interface IMohCreate {
  displayName: string;
  sort: string;
  entries: { filename: string; position: number }[];
}

export interface IMohUpdate {
  displayName?: string;
  sort?: string;
  entries?: { filename: string; position: number }[];
}
