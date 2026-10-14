import { BadRequestException } from '@nestjs/common';
import { DASHBOARD_LIMITS, type DashboardQuery } from '@krasterisk/shared';
export function parseDashboardQuery(raw:Record<string,unknown>):DashboardQuery {
  const out:DashboardQuery={};
  const enums:Record<string,string[]>={period:['today','yesterday','7d','30d','custom'],direction:['in','out','internal','external'],outcome:['accepted','missed','unknown','active'],origin:['telephony','autodial','ai'],state:['ringing','talking','waiting'],status:['online','offline','unknown']};
  for(const [key,allowed] of Object.entries(enums)) {
    if(raw[key]!==undefined) { if(typeof raw[key]!=='string'||!allowed.includes(raw[key] as string)) throw new BadRequestException('Invalid '+key); (out as any)[key]=raw[key]; }
  }
  for(const key of ['from','to','search','cursor']) if(raw[key]!==undefined) {
    const value=raw[key]; if(typeof value!=='string'||value.length>(key==='cursor'?1024:key==='search'?100:40)) throw new BadRequestException('Invalid '+key);
    (out as any)[key]=value;
  }
  if(raw.version!==undefined) { if(typeof raw.version!=='string'||!/^[a-f0-9]{64}$/.test(raw.version)) throw new BadRequestException('Invalid version'); out.version=raw.version; }
  if(raw.limit!==undefined) {
    const value=Number(raw.limit);
    if(!Number.isSafeInteger(value)||value<1||value>DASHBOARD_LIMITS.maxPageSize) throw new BadRequestException('Invalid limit');
    out.limit=value;
  }
  return out;
}
