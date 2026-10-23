const parts = (at: number, timezone: string) => new Intl.DateTimeFormat('sv-SE',{timeZone:timezone,year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',second:'2-digit',hourCycle:'h23'}).format(at).replace(' ','T');
export function callLocalDateTime(value: string, timezone: string): string {
 return Number.isFinite(Date.parse(value)) ? parts(Date.parse(value),timezone).slice(0,16) : '';
}
/** Resolve a wall clock through the organization's IANA rules, never browser TZ. */
export function callDateTimeInstant(value: string, timezone: string, end = false): string | null {
 if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(value)) return null;
 const wall = Date.parse(value+':00Z');
 if (!Number.isFinite(wall)) return null;
 const candidates = new Set<number>();
 for(let h=-36;h<=36;h+=6){
  const probe=wall+h*3600000;
  const offset=Date.parse(parts(probe,timezone)+'Z')-probe;
  const instant=wall-offset;
  if(parts(instant,timezone).slice(0,16)===value)candidates.add(instant);
 }
 const times=[...candidates].sort((a,b)=>a-b);
 return times.length ? new Date(end ? times[times.length-1] : times[0]).toISOString() : null;
}
