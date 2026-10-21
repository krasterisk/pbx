import { maskPrivacyEntries, reuseTranscriptPrivacy, alignTranscriptPrivacyEvidence } from './text-privacy';

function fixture() {
  const entries=[{id:'s0',ordinal:0,text:'Трофимова не записана. Цена 3200 рублей.'},{id:'s1',ordinal:1,text:'Личный счёт 3200.'}];
  const prepared=maskPrivacyEntries(entries,{reviewedIds:['s0','s1'],uncertain:false,entities:[{entryId:'s0',quote:'Трофимова',type:'PERSON'},{entryId:'s1',quote:'3200',type:'ACCOUNT'}]});
  const binding={profile:'sa-transcript-spans-v1',segments:prepared.sourceBindings.map(({entryId,...row})=>({ordinal:Number(entryId.slice(1)),...row}))};
  return {entries,binding,evidence:[{kind:'text_privacy',transcriptBindings:binding}]};
}
describe('source-bound privacy evidence reuse',()=>{
  it('keeps positions valid when diarization joins consecutive originals into a new ordinal',()=>{
    const f=fixture(),output={id:'joined',ordinal:7,text:f.entries.map(e=>e.text).join(' ')};
    const evidence=alignTranscriptPrivacyEvidence(f.evidence,f.entries,[output]);
    const masked=reuseTranscriptPrivacy([output],evidence).entries[0].text;
    expect(masked).toBe('[PERSON_1] не записана. Цена 3200 рублей. Личный счёт [ACCOUNT_2].');
    expect(()=>alignTranscriptPrivacyEvidence(f.evidence,f.entries,[{ordinal:0,text:'Переписанный текст'}])).toThrow('text_privacy_binding_alignment');
  });
  it('reuses a previously detected short surname without another NER pass, preserving price and negation',()=>{
    const f=fixture(),out=reuseTranscriptPrivacy(f.entries,f.evidence);
    expect(out.entries[0].text).toBe('[PERSON_1] не записана. Цена 3200 рублей.');
    expect(out.entries[1].text).toBe('Личный счёт [ACCOUNT_2].');
    expect(out.restoreQuote('s0',out.entries[0].text)).toBe(f.entries[0].text);
    expect(JSON.stringify(f.binding)).not.toContain('Трофимова');
    expect(JSON.stringify(f.binding)).not.toContain('3200');
  });
  it('binds to ordinal and normalized source rather than a caller-supplied segment ID',()=>{
    const f=fixture();f.entries[0].id='authorized-sql-segment';f.entries[0].text='Трофимова   не записана. Цена 3200 рублей.';
    expect(reuseTranscriptPrivacy(f.entries,f.evidence).entries[0].text).toContain('[PERSON_1] не записана');
  });
  it.each(['text','ordinal','duplicate','offset','type','digest','profile','missing','multiple'])('rejects %s drift before cloud egress',kind=>{
    const f=fixture();
    if(kind==='text')f.entries[0].text='Другой клиент';
    if(kind==='ordinal')f.entries[0].ordinal=7;
    if(kind==='duplicate')f.binding.segments[1].ordinal=0;
    if(kind==='offset')f.binding.segments[0].spans[0].end=9999;
    if(kind==='type')f.binding.segments[0].spans[0].type='UNTRUSTED';
    if(kind==='digest')f.binding.segments[0].digest='0'.repeat(64);
    if(kind==='profile')f.binding.profile='future-unknown';
    if(kind==='missing')f.evidence=[];
    if(kind==='multiple')f.evidence.push(f.evidence[0]);
    expect(()=>reuseTranscriptPrivacy(f.entries,f.evidence)).toThrow('text_privacy_source_evidence_invalid');
  });
});
