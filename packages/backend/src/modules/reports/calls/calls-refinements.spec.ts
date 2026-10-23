import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import ExcelJS from 'exceljs';
import { callConnectionResult, type CallsAttention } from '@krasterisk/shared';
import { classifyCall } from '../../calls/call-record';
import { callDimensions } from '../../calls/call-dimensions';
import { callsWhere } from './calls-query';
import { CallsQueryDto } from './calls-query.dto';
import { callExportTime, exportCallAttention } from './calls-export';

describe('CDR report refinements', () => {
  it('indexes only ring groups proven by an owned native routing context',()=>{
    const legs=[{uniqueid:'group-call',linkedid:'group-call',calldate:'2026-10-22 10:00:00',channel:'PJSIP/e201_42-a',lastapp:'Dial',disposition:'ANSWERED',duration:20,billsec:10}];
    const events=[{uniqueid:'group-call',linkedid:'group-call',channame:'PJSIP/e201_42-a',eventtype:'APP_START',eventtime:'2026-10-22 10:00:01',context:'group_700_42'},
      {uniqueid:'foreign',channame:'PJSIP/e999_42-b',eventtype:'APP_START',eventtime:'2026-10-22 10:00:01',context:'group_701_42'},
      {uniqueid:'group-call',channame:'PJSIP/e201_42-a',eventtype:'APP_START',eventtime:'2026-10-22 10:00:01',context:'group_702_99'}];
    const call=classifyCall(42,'node',legs,{complete:true},'UTC',events);
    expect(call.groups).toEqual([{id:'700',name:'700'}]);
    expect(callDimensions(call)).toContainEqual({kind:'group',value:'700',label:'700'});
    const filter=callsWhere(42,{groups:['700','701']},{from:0,to:1},{operators:['201'],queues:[]});
    expect(filter.args).toMatchObject({tenant:42,kind_groups:'group',values_groups:['700','701']});expect(filter.sql).toContain('dashboard_participants');
  });
  it('rejects broad one-character searches before SQL construction',()=>{
    for(const search of ['2','20','  а  '])expect(()=>callsWhere(42,{search},{from:0,to:1},null)).toThrow('3 to 200');
    const filter=callsWhere(42,{search:'201'},{from:0,to:1},null);expect(filter.args.phone).toBe('%201%');expect(filter.sql).toContain('c.tenant=:tenant');
  });
  it('accepts repeated filters, bounds list sizes and rejects unknown values', async () => {
    expect(await validate(plainToInstance(CallsQueryDto, {directions:['in','out'],handlings:['employee','aiRobot'],results:['busy'],numbers:['+7 913 555-11-22'],numberRole:'caller',trunks:['t_main_42']}))).toHaveLength(0);
    expect(await validate(plainToInstance(CallsQueryDto, {directions:['invalid'],numbers:Array(31).fill('101')}))).not.toHaveLength(0);
  });
  it.each(['mysql','postgres'])('uses parameterized OR groups and retains tenant/ACL predicates (%s)', dialect => {
    const filter = callsWhere(42,{directions:['in','out'],handlings:['employee','autodial'],numbers:['8 (913) 555-11-22','79135553344'],numberRole:'caller',trunks:['t_main_42'],results:['busy'],outcomes:['robot']},{from:0,to:1},{operators:['201'],queues:[],ownExten:'201'},dialect);
    expect(filter.sql).toContain('c.tenant=:tenant');
    expect(filter.sql).toContain('c.direction IN (:directions)');
    expect(filter.sql).toContain('f.caller_number IN (:numbers)');
    expect(filter.sql).not.toContain('f.recipient_number IN (:numbers)');
    expect(filter.sql).toContain("trunk_d.kind='trunk'");
    expect(filter.sql).toContain('trunk_d.tenant=:tenant');
    expect(filter.sql).toContain('OR c.origin=');
    expect(filter.sql).toContain("f.outcome IN ('missed','error','unknown')");
    expect(filter.sql).toContain('dashboard_participants');
    expect(filter.args.numbers).toEqual(['79135551122','79135553344']);
    expect(filter.sql).not.toContain('7913555');
    if(dialect==='postgres') expect(filter.sql).toContain('jsonb_array_elements');
    else expect(filter.sql).toContain('JSON_CONTAINS');
  });
  it('keeps accepted outcomes above failed legs and distinguishes BUSY from NO ANSWER', () => {
    const attempts = [{kind:'attempt',result:'busy'}] as never;
    expect(callConnectionResult({outcome:'human',journey:attempts})).toBeNull();
    expect(callConnectionResult({outcome:'robot',journey:attempts})).toBeNull();
    expect(callConnectionResult({outcome:'missed',journey:attempts})).toBe('busy');
    expect(callConnectionResult({outcome:'missed',journey:[{kind:'attempt',result:'busy'},{kind:'queue',result:'noAnswer'}] as never})).toBe('noAnswer');
    expect(callConnectionResult({outcome:'unknown',journey:[]})).toBe('unavailable');
  });
  it('projects only own tenant trunks, including hyphenated names, into an indexed dimension', () => {
    const call = classifyCall(42,'node',[{uniqueid:'one',calldate:'2026-10-20 10:00:00',channel:'PJSIP/t_carrier-east_42-000ab',dstchannel:'PJSIP/t_foreign_99-000cd',lastapp:'Dial',disposition:'BUSY',duration:2}],{complete:true});
    expect(call.trunks).toEqual([{id:'t_carrier-east_42',name:'carrier-east'}]);
    expect(callDimensions(call)).toContainEqual({kind:'trunk',value:'t_carrier-east_42',label:'carrier-east'});
    expect(callDimensions(call).some(row=>row.value.includes('foreign'))).toBe(false);
  });
  it.each([['BUSY','busy'],['NO ANSWER','noAnswer'],['FAILED','unavailable']])('retains raw %s when the final application has no route attempt', (disposition, result) => {
    const call = classifyCall(42,'node',[{uniqueid:'terminal',calldate:'2026-10-20 10:00:00',channel:'PJSIP/e201_42-000ab',dstchannel:'PJSIP/t_main_42-000cd',lastapp:'Hangup',disposition,duration:2}],{complete:true});
    expect(callConnectionResult(call)).toBe(result);
  });
  it('exports local calendar timestamps, safe CSV cells and a real XLSX workbook', async () => {
    const snapshot = {timezone:'Asia/Krasnoyarsk',coverage:'partial',snapshotAt:'2026-10-20T20:00:00Z',rows:[{number:'=HYPERLINK("bad")',companyNumber:'00101',state:'waiting',firstAt:'2026-10-20T19:00:00Z',deadline:'2026-10-21T19:00:00Z',sourceCalls:3}]} as CallsAttention;
    expect(callExportTime(snapshot.rows[0].firstAt,snapshot.timezone)).toBe('2026-10-21 02:00:00');
    const csv = (await exportCallAttention(snapshot,'csv')).toString('utf8');
    expect(csv).toContain("'"+'=HYPERLINK');
    expect(csv).toContain('2026-10-21 02:00:00');
    expect(csv).toContain('partial');
    expect(csv).not.toContain('Часовой пояс');
    expect(csv).not.toContain('Asia/Krasnoyarsk');
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(await exportCallAttention(snapshot,'xlsx') as never);
    expect(workbook.worksheets[0].rowCount).toBe(2);
    expect(workbook.worksheets[0].getCell(2,2).value).toBe('00101');
    expect(workbook.worksheets[0].getCell(2,1).type).toBe(ExcelJS.ValueType.String);
  });
});
