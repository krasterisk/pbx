import { createHash } from 'node:crypto';
function stable(value:unknown):unknown {return Array.isArray(value)?value.map(stable):value&&typeof value==='object'?Object.fromEntries(Object.entries(value).sort(([a],[b])=>a.localeCompare(b)).map(([k,v])=>[k,stable(v)])):value;}
export function stateFingerprint(value:unknown):string {return createHash('sha256').update(JSON.stringify(stable(value))??'null').digest('hex');}
export function routeState(row:any):Record<string,unknown> {return Object.fromEntries(['name','extensions','actions','active','options','webhooks','context_uid','raw_dialplan','priority'].map(k=>[k,k==='active'?!!row[k]:row[k]??null]));}
export function timeGroupState(row:any):Record<string,unknown> {return {name:row.name,comment:row.comment??'',intervals:row.intervals??[]};}
