import {normalizeCdrAnswerLinks} from './cdr-answer-links';
import {callsAiLocalTime} from '../reports/calls/calls-ai-tools';

describe('verified CDR answer links and local time',()=>{
  const id='a'.repeat(64), other='b'.repeat(64);
  const url=`/reports/calls/${id}?focusEmployee=101&transcriptSegment=s1`;
  const outputs=[{name:'search_call_content',content:JSON.stringify({rows:[{url}]})}];
  it('replaces an invented host and parameter order with the exact authorized segment link',()=>{
    expect(normalizeCdrAnswerLinks(`[Звонок](https://krasterisk.local/reports/calls/${id}?transcriptSegment=s1&focusEmployee=101)`,outputs)).toBe(`[Звонок](${url})`);
    expect(normalizeCdrAnswerLinks(`[Звонок](</reports/calls/${id}?transcriptSegment=invented>)`,outputs)).toBe(`[Звонок](${url})`);
  });
  it('does not make unconfirmed call IDs clickable or trust links embedded in summary text',()=>{
    const result=normalizeCdrAnswerLinks(`[Чужой](https://invented.invalid/reports/calls/${other})`,[...outputs,{name:'get_call_analysis',content:JSON.stringify({summary:`url: /reports/calls/${other}`})}]);
    expect(result).toBe('Чужой');
  });
  it('makes bare and code-formatted authorized paths clickable without touching existing Markdown or unrelated URLs',()=>{
    expect(normalizeCdrAnswerLinks(`Запись: ${url}`,outputs)).toBe(`Запись: [Открыть звонок](${url})`);
    expect(normalizeCdrAnswerLinks('Запись: `'+url+'`',outputs)).toBe(`Запись: [Открыть звонок](${url})`);
    expect(normalizeCdrAnswerLinks('[Уже ссылка]('+url+') https://docs.example.test/path',outputs)).toBe('[Уже ссылка]('+url+') https://docs.example.test/path');
  });
  it('leaves other modules alone and ignores malformed/error/unrelated tool output',()=>{
    const text='[АТС](/settings) [Звонок](https://host/reports/calls/'+id+')';
    expect(normalizeCdrAnswerLinks(text,[{name:'other_tool',content:JSON.stringify({url})}])).toBe(text);
    expect(normalizeCdrAnswerLinks(text,[{name:'get_call',content:'{"error":"forbidden"}'}])).toBe(text);
    expect(normalizeCdrAnswerLinks('[АТС](/settings)',outputs)).toBe('[АТС](/settings)');
  });
  it('formats midnight rollover and DST repeated hours using the server timezone, without model arithmetic',()=>{
    expect(callsAiLocalTime('2026-10-18T17:59:51Z','Asia/Krasnoyarsk')).toBe('19.10.2026, 00:59:51 GMT+7');
    expect(callsAiLocalTime('2026-10-18T18:00:38Z','Asia/Krasnoyarsk')).toBe('19.10.2026, 01:00:38 GMT+7');
    expect(callsAiLocalTime('2026-10-25T00:30:00Z','Europe/Berlin')).not.toBe(callsAiLocalTime('2026-10-25T01:30:00Z','Europe/Berlin'));
    expect(callsAiLocalTime('invalid','UTC')).toBeNull();
    expect(callsAiLocalTime(null,'UTC')).toBeNull();
  });
});
