import { Select } from '@/shared/ui';

export function formatPhoneOffset(minutes: number): string {
  return `UTC${minutes < 0 ? '−' : '+'}${String(Math.floor(Math.abs(minutes) / 60)).padStart(2, '0')}:${String(Math.abs(minutes) % 60).padStart(2, '0')}`;
}
/** Stored offsets are fixed minutes, not IANA zones and not DST-aware cities. */
export function PhoneOffsetSelect({ id, value, onChange }: { id: string; value: number; onChange: (minutes: number) => void }) {
  const offsets = Array.from({ length: 105 }, (_, index) => -720 + index * 15);
  if (!offsets.includes(value)) offsets.push(value);
  return <Select id={id} value={value} onChange={(event) => onChange(Number(event.target.value))}>
    {offsets.sort((a, b) => a - b).map((offset) => <option key={offset} value={offset}>{formatPhoneOffset(offset)}</option>)}
  </Select>;
}
