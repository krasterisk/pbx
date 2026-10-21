import axios from 'axios';
import {
  defaultSaProjectConfig,
  saTextPrivacyEnabled,
} from '@krasterisk/shared';
import {
  maskPrivacyEntries,
  preparePrivateText,
  prepareAnalysisText,
  preparePrivateJson,
  reuseTranscriptPrivacy,
  minimalPrivacyContext,
  isShortPrivacyDate,
} from './text-privacy';
import {
  runAnalysis,
  type RunAnalysisDeps,
  type RunAnalysisInput,
} from './run-analysis';
import {
  assertValidTemplate,
  metricSetStamp,
} from '../projects/project-editor.service';
jest.mock('axios');
jest.mock('../../ai-connectivity/secret-cipher.util', () => ({
  decryptSecret: () => 'private-test-key',
}));

describe('source-bound local privacy', () => {
  it('masks a clear Russian name with patronymic even if the local model misses it', () => {
    const text = 'Хорошо, Татьяна Владимировна, запись 2 октября на 8:30. Цена 3200 рублей.';
    const result = maskPrivacyEntries([{ id: 's', text }], { reviewedIds: ['s'], uncertain: false, entities: [] });
    expect(result.entries[0].text).toBe('Хорошо, [PERSON_1], запись 2 октября на 8:30. Цена 3200 рублей.');
    expect(result.restoreQuote('s', result.entries[0].text)).toBe(text);
    expect(maskPrivacyEntries([{ id: 's', text: 'Повторный Приём стоит 3200 рублей.' }], { reviewedIds: ['s'], uncertain: false, entities: [] }).replacements).toBe(0);
  });
  it('replaces a date of birth without deleting an appointment date or price',()=>{
    const result=maskPrivacyEntries([{id:'s',text:'Родилась 12.03.1985. Запись 12.03.2027, цена 3200.'}],{reviewedIds:['s'],uncertain:false,entities:[{entryId:'s',quote:'12.03.1985',type:'BIRTH_DATE'}]});
    expect(result.entries[0].text).toBe('Родилась [BIRTH_DATE_1]. Запись 12.03.2027, цена 3200.');
  });
  const entries = [
    {
      id: '1',
      text: 'Иван Петров, +7 913 000 11 22. Не записан. Цена 3200 рублей.',
    },
    { id: '2', text: 'Иван Петров просит справку.' },
  ];
  const valid = {
    reviewedIds: ['1', '2'],
    uncertain: false,
    entities: [
      { entryId: '1', quote: 'Иван Петров', type: 'PERSON' },
      { entryId: '2', quote: 'Иван Петров', type: 'PERSON' },
    ],
  };
  it('preserves numbers/negation, masks repeated identities and regex contacts, restores source citations', () => {
    const result = maskPrivacyEntries(entries, valid);
    expect(result.entries[0].text).toBe(
      '[PERSON_1], [PHONE_2]. Не записан. Цена 3200 рублей.',
    );
    expect(result.entries[1].text).toBe('[PERSON_1] просит справку.');
    expect(result.restoreQuote('2', '[PERSON_1] просит справку.')).toBe(
      entries[1].text,
    );
    expect(result.restoreQuote('1', 'Не записан. Цена 3200 рублей.')).toBe(
      'Не записан. Цена 3200 рублей.',
    );
    expect(() => result.restoreQuote('1', 'PERSON_1')).toThrow('partial');
    expect(entries[0].text).toContain('Иван Петров');
  });
  it('covers an exact repeated identity even when the model lists only its first entry', () => {
    const input = [
      { id: 'a', text: 'Иван Петров не записан. Цена 3200 рублей.' },
      { id: 'b', text: 'Иван\u00a0Петров просит справку. Иван Петров перезвонит.' },
      { id: 'c', text: 'Петров Иван, запись 12.03.2027.' },
    ];
    const result = maskPrivacyEntries(input, {
      reviewedIds: ['a', 'b', 'c'], uncertain: false,
      entities: [{ entryId: 'a', quote: 'Иван Петров', type: 'PERSON' }],
    });
    expect(result.entries.map(entry => entry.text)).toEqual([
      '[PERSON_1] не записан. Цена 3200 рублей.',
      '[PERSON_1] просит справку. [PERSON_1] перезвонит.',
      input[2].text,
    ]);
    expect(result.restoreQuote('b', result.entries[1].text)).toBe(
      input[1].text.replace('\u00a0', ' '),
    );
    expect(input[1].text).toContain('Иван\u00a0Петров');
    expect(result.propagatedSpanCount).toBe(2);
    // Entity knowledge is scoped to this invocation, never shared with another call.
    const unrelated = maskPrivacyEntries(input, { reviewedIds: ['a', 'b', 'c'], uncertain: false, entities: [] });
    expect(unrelated.entries[0].text).toBe(input[0].text);
    expect(unrelated.replacements).toBe(0);
  });
  it.each([
    { ...valid, uncertain: true },
    { ...valid, reviewedIds: ['1'] },
    {
      ...valid,
      entities: [{ entryId: 'foreign', quote: 'Иван', type: 'PERSON' }],
    },
    { ...valid, entities: [{ entryId: '1', quote: 'Павел', type: 'PERSON' }] },
  ])('rejects incomplete review or fabricated spans', (bad) =>
    expect(() => maskPrivacyEntries(entries, bad)).toThrow('text_privacy'),
  );
  it('does not extend account numbers or short names into unrelated prices or words', () => {
    const input = [
      { id: 'a', text: 'Номер счёта 3200. Иван.' },
      { id: 'b', text: 'Цена 3200. Иван не записан. Иванов просит справку.' },
    ];
    const result = maskPrivacyEntries(input, {
      reviewedIds: ['a', 'b'], uncertain: false, entities: [
        { entryId: 'a', quote: '3200', type: 'ACCOUNT' },
        { entryId: 'a', quote: 'Иван', type: 'PERSON' },
      ],
    });
    expect(result.entries[0].text).toBe('Номер счёта [ACCOUNT_1]. [PERSON_2].');
    expect(result.entries[1]).toEqual(input[1]);
    expect(result.propagatedSpanCount).toBe(0);
  });
  it('propagates only complete literal names, preserving different words and compounds', () => {
    const input = [
      { id: 'a', text: 'Иван Петров. Иван Петров не записан.' },
      { id: 'b', text: '«Иван Петров», цена 3200. Иван Петровский. Иван Петров-Сидоров. Иван Петров1. Иван Петров_2. ИванxПетров.' },
    ];
    const result = maskPrivacyEntries(input, {
      reviewedIds: ['a', 'b'], uncertain: false,
      entities: [{ entryId: 'a', quote: 'Иван Петров', type: 'PERSON' }],
    });
    expect(result.entries[0].text).toBe('[PERSON_1]. [PERSON_1] не записан.');
    expect(result.entries[1].text).toBe(
      '«[PERSON_1]», цена 3200. Иван Петровский. Иван Петров-Сидоров. Иван Петров1. Иван Петров_2. ИванxПетров.',
    );
    expect(result.propagatedSpanCount).toBe(1);
    expect(result.restoreQuote('b', result.entries[1].text)).toBe(input[1].text);
  });
  it.each(['Иван.Петров', 'Иван (Петров)', 'Иван.*Петров'])(
    'does not interpret a detected %s as a regular expression or eligible full name', quote => {
      const input = [ { id: 'a', text: quote }, { id: 'b', text: `${quote}. Иван Петров не записан.` } ];
      const result = maskPrivacyEntries(input, {
        reviewedIds: ['a', 'b'], uncertain: false, entities: [{ entryId: 'a', quote, type: 'PERSON' }],
      });
      expect(result.entries[0].text).toBe('[PERSON_1]');
      expect(result.entries[1]).toEqual(input[1]);
      expect(result.propagatedSpanCount).toBe(0);
    },
  );
  it.each([3000, 3001])('bounds additional literal source spans without silently truncating (%i)', count => {
    const input = [
      { id: 'a', text: 'Анна Ли' },
      { id: 'b', text: 'Анна Ли. '.repeat(1500) },
      { id: 'c', text: 'Анна Ли. '.repeat(count - 1500) },
    ];
    const prepare = () => maskPrivacyEntries(input, { reviewedIds: ['a', 'b', 'c'], uncertain: false,
      entities: [{ entryId: 'a', quote: 'Анна Ли', type: 'PERSON' }],
    });
    if (count === 3001) expect(prepare).toThrow('text_privacy_propagation_limit');
    else {
      const result = prepare();
      expect(result.propagatedSpanCount).toBe(3000);
      expect(result.entries[2].text).not.toContain('Анна Ли');
      expect(result.restoreQuote('c', result.entries[2].text)).toBe(input[2].text.trim());
    }
  });
  it('has a stable legacy-off policy and publishes protection as a new version', () => {
    const config = defaultSaProjectConfig();
    expect(saTextPrivacyEnabled(config)).toBe(false);
    expect(
      metricSetStamp({ ...config, textPrivacy: { anonymizeBeforeLlm: false } }),
    ).toBe(metricSetStamp(config));
    expect(
      metricSetStamp({ ...config, textPrivacy: { anonymizeBeforeLlm: true } }),
    ).not.toBe(metricSetStamp(config));
    expect(() =>
      assertValidTemplate({
        ...config,
        textPrivacy: { anonymizeBeforeLlm: 'true' } as never,
      }),
    ).toThrow('invalid_text_privacy');
    expect(() =>
      saTextPrivacyEnabled({ ...config, textPrivacy: null as never }),
    ).toThrow('invalid_text_privacy');
  });
  const provider = {
    uid: 15,
    name: 'aipbx',
    vendor: 'aipbx',
    enabled: true,
    is_global: true,
    capabilities: ['llm'],
    endpoint: 'https://aipbx.ru/api/v1/chat/completions',
    auth_type: 'bearer',
    encrypted_api_key: 'cipher',
    defaults: { model: 'qwen3.5:8b' },
  };
  const repeatedIdentifier = [
    { id: 'a', text: 'Номер заявки ZX-42.' },
    { id: 'b', text: 'ZX-42 не отменена, цена 3200 рублей.' },
  ];
  function privacyResponse(ids: string[], entities: unknown[], uncertain = false) {
    return { data: { model: provider.defaults.model, choices: [{ finish_reason: 'stop', message: {
      content: JSON.stringify({ reviewedIds: ids, uncertain, entities }),
    } }] } };
  }
  it('reviews case variants using literal source quotes without guessing spellings', async () => {
    const input = [{ id: 'a', text: 'Улица Карамзина.' }, { id: 'b', text: 'Да, улица карамзина.' }];
    const post = jest.mocked(axios.post).mockReset();
    post.mockResolvedValueOnce(privacyResponse(['a', 'b'], [{ entryId: 'a', quote: 'Карамзина', type: 'ADDRESS' }]))
      .mockResolvedValueOnce({ data: { model: provider.defaults.model, choices: [{ finish_reason: 'stop', message: {
        content: JSON.stringify({ reviewedIds: ['b'], uncertain: false, decisions: { d0: true } }),
      } }] } });
    const result = await preparePrivateText(input, { findGlobal: async () => [provider as never] });
    expect(result.entries.map(e => e.text)).toEqual(['Улица [ADDRESS_1].', 'Да, улица [ADDRESS_1].']);
    expect(result.restoreQuote('b', result.entries[1].text)).toBe(input[1].text);
    expect(JSON.parse((post.mock.calls[1][1] as any).messages[1].content).coverageReview.candidates)
      .toEqual([{ entryId: 'b', quote: 'карамзина', type: 'ADDRESS' }]);
  });
  it('requires local reconsideration before treating a whole acknowledgment as a name', async () => {
    const post = jest.mocked(axios.post).mockReset();
    post.mockResolvedValueOnce(privacyResponse(['a'], [{ entryId: 'a', quote: 'Да.', type: 'PERSON' }]))
      .mockResolvedValueOnce(privacyResponse(['a'], []));
    const result = await preparePrivateText([{ id: 'a', text: 'Да.' }], { findGlobal: async () => [provider as never] });
    expect(result.entries[0].text).toBe('Да.');
    expect(post).toHaveBeenCalledTimes(2);
  });
  it('rechecks an overbroad span locally and preserves appointment, price and negation', async () => {
    const text = 'Иван Петров, дата рождения 12.03.1985. Не отменяйте запись на пятницу, цена 3200 рублей.';
    const post = jest.mocked(axios.post).mockReset();
    post.mockResolvedValueOnce(privacyResponse(['a'], [{ entryId: 'a', quote: text, type: 'BIRTH_DATE' }]))
      .mockResolvedValueOnce(privacyResponse(['a'], [
        { entryId: 'a', quote: 'Иван Петров', type: 'PERSON' },
        { entryId: 'a', quote: '12.03.1985', type: 'BIRTH_DATE' },
      ]));
    const result = await preparePrivateText([{ id: 'a', text }], { findGlobal: async () => [provider as never] });
    expect(result.entries[0].text).toBe('[PERSON_1], дата рождения [BIRTH_DATE_2]. Не отменяйте запись на пятницу, цена 3200 рублей.');
    expect(result.restoreQuote('a', result.entries[0].text)).toBe(text);
    expect(result.receipt.minimalSpanReviewCount).toBe(1);
    expect(post).toHaveBeenCalledTimes(2);
  });
  it.each([false, true])('uses bounded earlier speech context for a date-only reply (birth=%s)', async birth => {
    const entries = [
      {id:'s0',text:birth?'Назовите дату рождения.':'На какую дату хотите перенести запись?'},
      ...Array.from({length:11},(_,i)=>({id:`s${i+1}`,text:'Сейчас проверю.'})),
      {id:'s12',text:'Девятого сентября.'},
    ];
    const date = {entryId:'s12',quote:'Девятого сентября',type:'BIRTH_DATE'};
    const post = jest.mocked(axios.post).mockReset();
    post.mockResolvedValueOnce(privacyResponse(entries.slice(0,12).map(e=>e.id), []))
      .mockResolvedValueOnce(privacyResponse(['s12'], [date]))
      .mockResolvedValueOnce(privacyResponse(['s12'], birth?[date]:[]));
    const result = await preparePrivateText(entries,{findGlobal:async()=>[provider as never]});
    expect(result.entries[12].text).toBe(birth?'[BIRTH_DATE_1].':'Девятого сентября.');
    expect(result.restoreQuote('s12',result.entries[12].text)).toBe(entries[12].text);
    const request = JSON.parse((post.mock.calls[2][1] as any).messages[1].content);
    expect(request.entries).toEqual([entries[12]]);
    expect(request.contextEntries).toContainEqual(entries[0]);
    expect(result.receipt.minimalContextEntryCount).toBe(3);
    expect(post).toHaveBeenCalledTimes(3);
  });
  it('does not accept a read-only context ID as a mask target', async () => {
    const entries = [{id:'s0',text:'На какую дату перенести запись?'},
      ...Array.from({length:11},(_,i)=>({id:`s${i+1}`,text:'Проверю.'})),{id:'s12',text:'Девятого сентября.'}];
    const post = jest.mocked(axios.post).mockReset();
    post.mockResolvedValueOnce(privacyResponse(entries.slice(0,12).map(e=>e.id), []))
      .mockResolvedValueOnce(privacyResponse(['s12'], [{entryId:'s12',quote:'Девятого сентября',type:'BIRTH_DATE'}]))
      .mockResolvedValueOnce(privacyResponse(['s12'], [{entryId:'s0',quote:entries[0].text,type:'PERSON'}]));
    await expect(preparePrivateText(entries,{findGlobal:async()=>[provider as never]})).rejects.toThrow('text_privacy');
    expect(post).toHaveBeenCalledTimes(3);
  });
  it.each(['uncertain','foreign','business'])('requires a source-supported decision to resolve a repeatedly mislabeled appointment date (%s)', async purpose => {
    const text = 'Запишите на 25 сентября.',date={entryId:'a',quote:'25 сентября',type:'BIRTH_DATE'};
    const post=jest.mocked(axios.post).mockReset();
    post.mockResolvedValueOnce(privacyResponse(['a'],[date]))
      .mockResolvedValueOnce(privacyResponse(['a'],[date]))
      .mockResolvedValueOnce({data:{model:provider.defaults.model,choices:[{finish_reason:'stop',message:{content:JSON.stringify({decisions:{d0:{purpose:purpose==='uncertain'?'uncertain':'business_date',evidenceEntryId:purpose==='business'?'a':purpose==='foreign'?'foreign':''}}})}}]}});
    if(purpose==='business') {
      const result=await preparePrivateText([{id:'a',text}],{findGlobal:async()=>[provider as never]});
      expect(result.entries[0].text).toBe(text);
      expect(result.receipt).toMatchObject({datePurposeReviewCount:1,businessDateSpanCount:1});
      expect(result.restoreQuote('a',text)).toBe(text);
    } else await expect(preparePrivateText([{id:'a',text}],{findGlobal:async()=>[provider as never]})).rejects.toThrow('text_privacy_date_uncertain');
    expect(post).toHaveBeenCalledTimes(3);
    const purposeRequest = JSON.parse((post.mock.calls[2][1] as any).messages[1].content);
    expect(purposeRequest.candidates).toEqual([{key:'d0',entryId:'a',quote:'25 сентября'}]);
  });
  it('never sends personal names, years or phone-like strings into date-purpose repair', () => {
    for(const value of ['25 сентября Иван','12.03.1985','79135551122','да']) expect(isShortPrivacyDate(value)).toBe(false);
    for(const value of ['25 сентября','25-го числа.','двадцать пятого сентября']) expect(isShortPrivacyDate(value)).toBe(true);
  });
  it('bounds context to same-input speech entries and never truncates a source', () => {
    const entries = [{id:'s0',text:'На какую дату записать?'.padEnd(601,'x')},
      {id:'s1',text:'Проверю.'},{id:'s2',text:'Сейчас.'},{id:'s3',text:'Девятого сентября.'}];
    expect(minimalPrivacyContext(entries,[entries[3]])).toEqual(entries.slice(1,3));
    expect(minimalPrivacyContext(entries,[{id:'j1',text:'Project rule'}])).toEqual([]);
    expect(minimalPrivacyContext([{id:'s0',text:'ﬃ'.repeat(300)},entries[3]],[entries[3]])).toEqual([]);
    expect(minimalPrivacyContext([{id:'s0',text:'Рядом.'},{id:'s1',text:'а'.repeat(600)},{id:'s2',text:'б'.repeat(600)},entries[3]],[entries[3]])
      .reduce((n,e)=>n+e.text.length,0)).toBeLessThanOrEqual(1200);
  });
  it.each([false, true])('does not release an unresolved broad mask (uncertain=%s)', async uncertain => {
    const text = 'Пришлите адрес по СМС, запись на пятницу, цена 3200 рублей.';
    const entities = [{ entryId: 'a', quote: text, type: 'ADDRESS' }];
    const post = jest.mocked(axios.post).mockReset();
    post.mockResolvedValueOnce(privacyResponse(['a'], entities))
      .mockResolvedValueOnce(privacyResponse(['a'], entities, uncertain));
    await expect(preparePrivateText([{ id: 'a', text }], { findGlobal: async () => [provider as never] })).rejects.toThrow('text_privacy');
    expect(post).toHaveBeenCalledTimes(2);
  });
  it('preserves a generic price query only after a complete second local review', async () => {
    const text = 'Повторный приём стоит 3200 рублей';
    const post = jest.mocked(axios.post).mockReset();
    post.mockResolvedValueOnce(privacyResponse(['query'], [{ entryId: 'query', quote: text, type: 'ORGANIZATION' }]))
      .mockResolvedValueOnce(privacyResponse(['query'], []));
    const result = await preparePrivateText([{ id: 'query', text }], { findGlobal: async () => [provider as never] }, { purpose: 'search_query' });
    expect(result.entries[0].text).toBe(text);
    expect(post).toHaveBeenCalledTimes(2);
  });
  function coverageProvider(second: (input: any) => unknown, input = repeatedIdentifier, primaryUncertain = false) {
    const post = jest.mocked(axios.post);
    post.mockReset();
    post.mockImplementation(async (_url, body: any) => {
      const request = JSON.parse(body.messages[1].content);
      const output = request.coverageReview ? second(request) : {
        reviewedIds: request.entries.map((entry: any) => entry.id), uncertain: primaryUncertain,
        entities: request.entries.some((entry: any) => entry.id === 'a')
          ? [{ entryId: 'a', quote: input[0].text.includes('3200') ? '3200' : 'ZX-42', type: input[0].text.includes('3200') ? 'ACCOUNT' : 'IDENTIFIER' }] : [],
      };
      return { data: { model: provider.defaults.model, choices: [{ finish_reason: 'stop', message: { content: JSON.stringify(output) } }] } };
    });
    return post;
  }
  it('reviews a missed exact identifier once using its original entry and keeps the original primary coverage', async () => {
    const post = coverageProvider(request => ({ reviewedIds: request.entries.map((entry: any) => entry.id), uncertain: false,
      entities: [{ entryId: 'b', quote: 'ZX-42', type: 'IDENTIFIER' }],
    }));
    const prepared = await preparePrivateText(repeatedIdentifier, { findGlobal: async () => [provider as never] });
    expect(post).toHaveBeenCalledTimes(2);
    const secondary = JSON.parse((post.mock.calls[1][1] as any).messages[1].content);
    expect(secondary.entries).toEqual([repeatedIdentifier[1]]);
    expect(secondary.coverageReview.candidates).toEqual([{ entryId: 'b', quote: 'ZX-42', type: 'IDENTIFIER' }]);
    const secondarySchema = JSON.parse(JSON.stringify((post.mock.calls[1][1] as any).response_format.json_schema.schema));
    expect(secondarySchema.properties.entities).toBeUndefined();
    expect(secondarySchema.properties.decisions).toEqual({type:'object',additionalProperties:false,required:['d0'],properties:{d0:{type:'boolean'}}});
    expect(prepared.entries[1].text).toBe('[IDENTIFIER_1] не отменена, цена 3200 рублей.');
    expect(prepared.restoreQuote('b', prepared.entries[1].text)).toBe(repeatedIdentifier[1].text);
    expect(prepared.receipt).toEqual(expect.objectContaining({ coveragePassCount: 1, newValidatedEntities: 1, residualBefore: 1, residualAfter: 0 }));
    expect(post.mock.calls[1][2]).toEqual(expect.objectContaining({ timeout: 90000 }));
    expect(post.mock.calls[1][1]).toEqual(expect.objectContaining({ max_tokens: 6000 }));
    post.mockReset();
  });
  it('does not find a numeric seed inside a generated alias or issue unnecessary review requests', async () => {
    const post = jest.mocked(axios.post);post.mockReset();
    post.mockResolvedValueOnce({ data: { model: provider.defaults.model, choices: [{ finish_reason: 'stop', message: { content: JSON.stringify({
      reviewedIds: ['a'], uncertain: false, entities: [{ entryId: 'a', quote: '1', type: 'IDENTIFIER' }],
    }) } }] } });
    const prepared = await preparePrivateText([{ id: 'a', text: '1' }], { findGlobal: async () => [provider as never] });
    expect(prepared.entries[0].text).toBe('[IDENTIFIER_1]');
    expect(prepared.receipt).toEqual(expect.objectContaining({ coveragePassCount: 0, residualBefore: 0, residualAfter: 0 }));
    expect(post).toHaveBeenCalledTimes(1);post.mockReset();
  });
  it('preserves a legitimate price and stops when one contextual review leaves a known account literal unresolved', async () => {
    const input = [{ id: 'a', text: 'Номер счёта 3200.' }, { id: 'b', text: 'Не записан, цена 3200 рублей.' }];
    const post = coverageProvider(request => ({ reviewedIds: request.entries.map((entry: any) => entry.id), uncertain: false, entities: [] }), input);
    await expect(preparePrivateText(input, { findGlobal: async () => [provider as never] })).rejects.toThrow('text_privacy_coverage_unresolved');
    expect(JSON.parse((post.mock.calls[1][1] as any).messages[1].content).entries).toEqual([input[1]]);
    expect(input[1].text).toBe('Не записан, цена 3200 рублей.');
    expect(post).toHaveBeenCalledTimes(2);post.mockReset();
  });
  it.each(['missing', 'uncertain', 'foreign', 'capacity', 'transport'])(
    'stops without retry when the single coverage review is %s', async kind => {
      const post = coverageProvider(request => {
        if (kind === 'transport') throw Error('private provider failure');
        return { reviewedIds: kind === 'missing' ? [] : request.entries.map((entry: any) => entry.id), uncertain: kind === 'uncertain',
          entities: kind === 'capacity'
            ? Array.from({ length: 128 }, () => ({ entryId: 'b', quote: 'ZX-42', type: 'IDENTIFIER' }))
            : [{ entryId: kind === 'foreign' ? 'a' : 'b', quote: 'ZX-42', type: 'IDENTIFIER' }],
        };
      });
      await expect(preparePrivateText(repeatedIdentifier, { findGlobal: async () => [provider as never] })).rejects.toThrow('text_privacy');
      expect(post).toHaveBeenCalledTimes(2);post.mockReset();
    },
  );
  it.each(['entries', 'chars'])('rejects oversized coverage %s before extra provider I/O', async kind => {
    const input = kind === 'entries'
      ? [repeatedIdentifier[0], ...Array.from({ length: 13 }, (_, i) => ({ id: `b${i}`, text: 'ZX-42.' }))]
      : [repeatedIdentifier[0], { id: 'b', text: 'ZX-42. ' + 'x'.repeat(3000) }];
    const post = coverageProvider(() => { throw Error('Must not call coverage provider'); }, input);
    await expect(preparePrivateText(input, { findGlobal: async () => [provider as never] })).rejects.toThrow('text_privacy_coverage_limit');
    expect(post).toHaveBeenCalledTimes(2);
    expect(post.mock.calls.every(call => !JSON.parse((call[1] as any).messages[1].content).coverageReview)).toBe(true);
    post.mockReset();
  });
  it('does not run a coverage pass after an uncertain primary review', async () => {
    const post = coverageProvider(() => { throw Error('No second request'); }, repeatedIdentifier, true);
    await expect(preparePrivateText(repeatedIdentifier, { findGlobal: async () => [provider as never] })).rejects.toThrow('text_privacy_invalid_response');
    expect(post).toHaveBeenCalledTimes(1);post.mockReset();
  });
  it('uses an immutable source snapshot even when the caller changes entries during provider lookup', async () => {
    const input = structuredClone(repeatedIdentifier);
    const post = coverageProvider(request => ({ reviewedIds: request.entries.map((entry: any) => entry.id), uncertain: false,
      entities: [{ entryId: 'b', quote: 'ZX-42', type: 'IDENTIFIER' }],
    }));
    const prepared = await preparePrivateText(input, { findGlobal: async () => {
      input[1] = { id: 'changed', text: 'Другой разговор.' };
      return [provider as never];
    } });
    expect(prepared.entries[1]).toEqual({ id: 'b', text: '[IDENTIFIER_1] не отменена, цена 3200 рублей.' });
    expect(prepared.restoreQuote('b', prepared.entries[1].text)).toBe(repeatedIdentifier[1].text);
    expect(input[1].id).toBe('changed');
    expect(post).toHaveBeenCalledTimes(2);post.mockReset();
  });
  it('does not recursively review a newly discovered identifier left in another original entry', async () => {
    const input = [...repeatedIdentifier.map(e => ({ ...e })), { id: 'c', text: 'Референс YZ-43.' }];
    input[1].text += ' Референс YZ-43.';
    const post = coverageProvider(request => ({ reviewedIds: request.entries.map((entry: any) => entry.id), uncertain: false,
      entities: [{ entryId: 'b', quote: 'ZX-42', type: 'IDENTIFIER' }, { entryId: 'b', quote: 'YZ-43', type: 'IDENTIFIER' }],
    }), input);
    await expect(preparePrivateText(input, { findGlobal: async () => [provider as never] })).rejects.toMatchObject({
      message: 'text_privacy_coverage_outside_candidate',
      textPrivacyAudit: expect.objectContaining({ coveragePassCount: 1, newValidatedEntities: 0, residualBefore: 1, residualAfter: null }),
    });
    expect(post).toHaveBeenCalledTimes(2);post.mockReset();
  });
  it('rejects an ambiguous source-ID repair inside the secondary subset', async () => {
    const input = [{ id: 'a', text: 'ZX-42 YZ-43.' }, { id: 'b', text: 'YZ-43.' }, { id: 'c', text: 'ZX-42.' }, { id: 'd', text: 'ZX-42.' }];
    const post = jest.mocked(axios.post);post.mockReset();
    post.mockImplementation(async (_url, body: any) => {
      const data = JSON.parse(body.messages[1].content);
      return { data: { model: provider.defaults.model, choices: [{ finish_reason: 'stop', message: { content: JSON.stringify({
        reviewedIds: data.entries.map((e: any) => e.id), uncertain: false,
        entities: data.coverageReview ? [{ entryId: 'b', quote: 'ZX-42', type: 'IDENTIFIER' }]
          : [{ entryId: 'a', quote: 'ZX-42', type: 'IDENTIFIER' }, { entryId: 'a', quote: 'YZ-43', type: 'IDENTIFIER' }],
      }) } }] } };
    });
    await expect(preparePrivateText(input, { findGlobal: async () => [provider as never] })).rejects.toThrow('text_privacy_coverage_outside_candidate');
    expect(post).toHaveBeenCalledTimes(2);post.mockReset();
  });
  it.each(['wide', 'subspan', 'price', 'retag'])(
    'rejects a source-valid secondary %s rather than expanding or repairing a selected candidate', async kind => {
      const quote = kind === 'wide' ? repeatedIdentifier[1].text : kind === 'subspan' ? 'ZX' : kind === 'price' ? '3200' : 'ZX-42';
      const post = coverageProvider(request => ({ reviewedIds: request.entries.map((entry: any) => entry.id), uncertain: false,
        entities: [{ entryId: 'b', quote, type: kind === 'retag' ? 'PERSON' : 'IDENTIFIER' }],
      }));
      await expect(preparePrivateText(repeatedIdentifier, { findGlobal: async () => [provider as never] })).rejects.toThrow('text_privacy_coverage_outside_candidate');
      expect(post).toHaveBeenCalledTimes(2);post.mockReset();
    },
  );
  it('rejects a raw wrong selector triplet before the primary v4 binder could uniquely repair it', async () => {
    const input = [{ id: 'a', text: 'ZX-42 YZ-43.' }, { id: 'b', text: 'ZX-42.' }, { id: 'c', text: 'YZ-43.' }];
    const post = jest.mocked(axios.post);post.mockReset();
    post.mockImplementation(async (_url, body: any) => {
      const data = JSON.parse(body.messages[1].content);
      return { data: { model: provider.defaults.model, choices: [{ finish_reason: 'stop', message: { content: JSON.stringify({
        reviewedIds: data.entries.map((e: any) => e.id), uncertain: false,
        entities: data.coverageReview ? [
          { entryId: 'b', quote: 'ZX-42', type: 'IDENTIFIER' },
          { entryId: 'b', quote: 'YZ-43', type: 'IDENTIFIER' },
        ] : [{ entryId: 'a', quote: 'ZX-42', type: 'IDENTIFIER' }, { entryId: 'a', quote: 'YZ-43', type: 'IDENTIFIER' }],
      }) } }] } };
    });
    await expect(preparePrivateText(input, { findGlobal: async () => [provider as never] })).rejects.toMatchObject({
      message: 'text_privacy_coverage_outside_candidate',
      textPrivacyAudit: expect.objectContaining({ coveragePassCount: 1, newValidatedEntities: 0, residualAfter: null }),
    });
    expect(post).toHaveBeenCalledTimes(2);post.mockReset();
  });
  it('rejects a retag that could otherwise trigger PERSON propagation beyond explicitly selected sources', async () => {
    const input = [{ id: 'a', text: 'Иван Петров.' }, { id: 'b', text: 'Иван Петров не записан.' }, { id: 'c', text: 'Иван Петров перезвонит.' }];
    const post = jest.mocked(axios.post);post.mockReset();
    post.mockImplementation(async (_url, body: any) => {
      const data = JSON.parse(body.messages[1].content);
      return { data: { model: provider.defaults.model, choices: [{ finish_reason: 'stop', message: { content: JSON.stringify({
        reviewedIds: data.entries.map((e: any) => e.id), uncertain: false,
        entities: data.coverageReview ? [{ entryId: 'b', quote: 'Иван Петров', type: 'PERSON' }]
          : [{ entryId: 'a', quote: 'Иван Петров', type: 'IDENTIFIER' }],
      }) } }] } };
    });
    await expect(preparePrivateText(input, { findGlobal: async () => [provider as never] })).rejects.toThrow('text_privacy_coverage_outside_candidate');
    expect(post).toHaveBeenCalledTimes(2);post.mockReset();
  });
  it('enforces the aggregate entity limit across primary batches and the single coverage response', async () => {
    let sequence = 0;
    const input = Array.from({ length: 24 }, (_, index) => ({ id: `p${index}`,
      text: Array.from({ length: index === 23 ? 79 : 127 }, () => `X${String(sequence++).padStart(5, '0')}`).join(' ') + ' ' + 'x'.repeat(2200),
    }));
    input.push({ id: 'b', text: 'X00000.' });
    const post = jest.mocked(axios.post);post.mockReset();
    post.mockImplementation(async (_url, body: any) => {
      const data = JSON.parse(body.messages[1].content);
      return { data: { model: provider.defaults.model, choices: [{ finish_reason: 'stop', message: { content: JSON.stringify({
        reviewedIds: data.entries.map((e: any) => e.id), uncertain: false,
        entities: data.coverageReview ? [{ entryId: 'b', quote: 'X00000', type: 'IDENTIFIER' }]
          : data.entries.flatMap((e: any) => e.id === 'b' ? [] : [...e.text.matchAll(/\bX\d{5}\b/g)].map(match => ({ entryId: e.id, quote: match[0], type: 'IDENTIFIER' }))),
      }) } }] } };
    });
    await expect(preparePrivateText(input, { findGlobal: async () => [provider as never] })).rejects.toThrow('text_privacy_invalid_response');
    expect(post).toHaveBeenCalledTimes(25);
    expect(post.mock.calls.filter(call => JSON.parse((call[1] as any).messages[1].content).coverageReview)).toHaveLength(1);
    post.mockReset();
  });
  it('covers a known identity in another reviewed batch without inventing a new model detection', async () => {
    const input = Array.from({ length: 13 }, (_, index) => ({
      id: `s${index}`,
      text: index === 0 || index === 12 ? 'Иван Петров не записан, цена 3200.' : 'Запись 12.03.2027.',
    }));
    const post = jest.mocked(axios.post);
    post.mockClear();
    post.mockImplementation(async (_url, body: any) => {
      const batch = JSON.parse(body.messages[1].content).entries as Array<{id: string; text: string}>;
      return { data: { model: provider.defaults.model, choices: [{ finish_reason: 'stop', message: {
        content: JSON.stringify({ reviewedIds: batch.map(entry => entry.id), uncertain: false,
          entities: batch.some(entry => entry.id === 's0')
            ? [{ entryId: 's0', quote: 'Иван Петров', type: 'PERSON' }] : [],
        }),
      } }] } };
    });
    const result = await preparePrivateText(input, { findGlobal: async () => [provider as never] });
    expect(post).toHaveBeenCalledTimes(2);
    expect(result.entries[0].text).toBe('[PERSON_1] не записан, цена 3200.');
    expect(result.entries[12].text).toBe('[PERSON_1] не записан, цена 3200.');
    expect(result.receipt.propagatedSpanCount).toBe(1);
    expect(result.restoreQuote('s12', result.entries[12].text)).toBe(input[12].text);
    expect(result.entries[1].text).toBe(input[1].text);
    expect(input[12].text).toContain('Иван Петров');
    post.mockReset();
  });
  it('honors the exact configured local endpoint and discards a sensitive provider error', async () => {
    jest
      .mocked(axios.post)
      .mockRejectedValueOnce({
        response: { status: 502 },
        request: { body: 'RAW PRIVATE' },
      });
    await expect(
      preparePrivateText(entries, {
        findGlobal: async () => [provider as never],
      }),
    ).rejects.toThrow('text_privacy_local_failed');
    expect(axios.post).toHaveBeenCalledWith(
      provider.endpoint,
      expect.objectContaining({ model: 'qwen3.5:8b' }),
      expect.objectContaining({ maxRedirects: 0 }),
    );
  });
  it('rejects another model instead of accepting a silent cloud substitution', async () => {
    jest
      .mocked(axios.post)
      .mockResolvedValueOnce({
        data: {
          model: 'cloud-model',
          choices: [
            {
              finish_reason: 'stop',
              message: { content: JSON.stringify(valid) },
            },
          ],
        },
      });
    await expect(
      preparePrivateText(entries, {
        findGlobal: async () => [provider as never],
      }),
    ).rejects.toThrow('text_privacy_local_output_incomplete');
  });
  it('requests non-thinking schema constrained to the current source IDs without forcing false certainty', async () => {
    jest.mocked(axios.post).mockResolvedValueOnce({ data: {
      model: provider.defaults.model,
      choices: [{ finish_reason: 'stop', message: { content: JSON.stringify(valid) } }],
    } });
    const prepared = await preparePrivateText(entries, { findGlobal: async () => [provider as never] });
    const body = jest.mocked(axios.post).mock.calls.at(-1)![1] as {
      think: boolean; response_format: { type: string; json_schema: { schema: {
        properties: { reviewedIds: { items: { enum: string[] }; minItems: number }; uncertain: { type: string }; entities: { maxItems: number; items: { properties: { entryId: { enum: string[] } } } } };
      } } };
    };
    expect(body.think).toBe(false);
    expect(body.response_format.type).toBe('json_schema');
    const schema = body.response_format.json_schema.schema;
    expect(schema.properties.reviewedIds.items.enum).toEqual(['1', '2']);
    expect(schema.properties.entities.items.properties.entryId.enum).toEqual(['1', '2']);
    expect(schema.properties.reviewedIds.minItems).toBe(2);
    expect(schema.properties.uncertain).toEqual({ type: 'boolean' });
    expect(schema.properties.entities.maxItems).toBe(128);
    expect(prepared.receipt.profile).toBe('sa-source-spans-v10');
    expect(prepared.entries[0].text).not.toContain('Иван Петров');
  });
  it.each([127, 128])('fails closed when a batch reaches its generation limit (%i entities)', async (count) => {
    const names = Array.from({ length: count }, (_, i) => `Клиент${String(i).padStart(3, '0')}`);
    const dense = [{ id: 'dense', text: `${names.join(' ')} Не записан, цена 3200 рублей.` }];
    jest.mocked(axios.post).mockResolvedValueOnce({ data: {
      model: provider.defaults.model,
      choices: [{ finish_reason: 'stop', message: { content: JSON.stringify({
        reviewedIds: ['dense'], uncertain: false,
        entities: names.map(quote => ({ entryId: 'dense', quote, type: 'PERSON' })),
      }) } }],
    } });
    const request = preparePrivateText(dense, { findGlobal: async () => [provider as never] });
    if (count === 128) {
      // A schema-forced stop at capacity must not be mistaken for complete PII coverage.
      await expect(request).rejects.toThrow('text_privacy_entity_batch_limit');
    } else {
      const prepared = await request;
      expect(prepared.entries[0].text).not.toContain('Клиент');
      expect(prepared.entries[0].text).toContain('Не записан, цена 3200 рублей.');
    }
  });
  it('retains the aggregate 3000-entity validation limit independently of generation', () => {
    expect(() => maskPrivacyEntries(entries, {
      ...valid,
      entities: Array.from({ length: 3001 }, () => valid.entities[0]),
    })).toThrow('text_privacy_invalid_response');
  });
  it('binds a known but mistaken entry ID only to its unique exact source quote', async () => {
    const input = [
      { id: 'a', text: 'Не записан. Цена 3200 рублей.' },
      { id: 'b', text: 'Клиент Иван Петров просит справку.' },
    ];
    jest.mocked(axios.post).mockResolvedValueOnce({ data: {
      model: provider.defaults.model, choices: [{ finish_reason: 'stop', message: { content: JSON.stringify({
        reviewedIds: ['a', 'b'], uncertain: false,
        entities: [{ entryId: 'a', quote: 'Иван Петров', type: 'PERSON' }],
      }) } }],
    } });
    const prepared = await preparePrivateText(input, { findGlobal: async () => [provider as never] });
    expect(prepared.entries).toEqual([
      input[0], { id: 'b', text: 'Клиент [PERSON_1] просит справку.' },
    ]);
    expect(prepared.restoreQuote('b', '[PERSON_1]')).toBe('Иван Петров');
    expect(prepared.receipt).toEqual(expect.objectContaining({ profile: 'sa-source-spans-v10', reboundEntityCount: 1 }));
    expect(input[1].text).toBe('Клиент Иван Петров просит справку.');
  });
  it.each([
    { reason: 'ambiguous', entryId: 'a', quote: 'Иван Петров', repeated: true },
    { reason: 'foreign ID', entryId: 'foreign', quote: 'Иван Петров', repeated: false },
    { reason: 'invented quote', entryId: 'a', quote: 'Павел Сидоров', repeated: false },
    { reason: 'case-only match', entryId: 'a', quote: 'иван петров', repeated: false },
    { reason: 'changed spelling', entryId: 'a', quote: 'Иван Петрович', repeated: false },
    { reason: 'invalid type', entryId: 'a', quote: 'Иван Петров', repeated: false, type: 'UNKNOWN' },
    { reason: 'blank quote', entryId: 'a', quote: '   ', repeated: false },
  ])('does not repair $reason source references', async ({ entryId, quote, repeated, type }) => {
    const input = [
      { id: 'a', text: 'Не записан. Цена 3200 рублей.' },
      { id: 'b', text: 'Клиент Иван Петров просит справку.' },
      ...(repeated ? [{ id: 'c', text: 'Иван Петров перезвонил.' }] : []),
    ];
    const post = jest.mocked(axios.post);post.mockReset();
    const rejected = { data: {
      model: provider.defaults.model, choices: [{ finish_reason: 'stop', message: { content: JSON.stringify({
        reviewedIds: input.map(entry => entry.id), uncertain: false,
        entities: [{ entryId, quote, type: type ?? 'PERSON' }],
      }) } }],
    } };
    post.mockResolvedValue(rejected);
    await expect(preparePrivateText(input, { findGlobal: async () => [provider as never] })).rejects.toThrow('text_privacy_');
    expect(post.mock.calls.length).toBeLessThanOrEqual(2);
    post.mockReset();
  });
  it('re-extracts invalid primary spans once using the untouched source and never the rejected text', async () => {
    const post=jest.mocked(axios.post);post.mockReset();
    const input=[{id:'s0',text:'Я Петрова. Родилась пятого мая. Не записана, цена 3200.'}];
    const response=(quote:string)=>({data:{model:provider.defaults.model,choices:[{finish_reason:'stop',message:{content:JSON.stringify({reviewedIds:['s0'],uncertain:false,entities:[{entryId:'s0',quote,type:'PERSON'}]})}}]}});
    post.mockResolvedValueOnce(response('Петрова Анна Ивановна')).mockResolvedValueOnce(response('Петрова'));
    const result=await preparePrivateText(input,{findGlobal:async()=>[provider as never]});
    expect(post).toHaveBeenCalledTimes(2);
    expect(result.entries[0].text).toBe('Я [PERSON_1]. Родилась пятого мая. Не записана, цена 3200.');
    expect(result.receipt.sourceSpanRepairCount).toBe(1);
    const retry=post.mock.calls[1][1] as {messages:Array<{content:string}>};
    expect(JSON.parse(retry.messages[1].content).entries).toEqual(input);
    expect(JSON.stringify(retry)).not.toContain('Петрова Анна Ивановна');
    post.mockReset();
  });
  it.each(['uncertain','truncated','transport'])('does not re-extract a %s primary response', async kind=>{
    const post=jest.mocked(axios.post);post.mockReset();
    if(kind==='transport')post.mockRejectedValue(new Error('private transport error'));
    else post.mockResolvedValue({data:{model:provider.defaults.model,choices:[{finish_reason:kind==='truncated'?'length':'stop',message:{content:JSON.stringify({reviewedIds:['s'],uncertain:kind==='uncertain',entities:[{entryId:'s',quote:'invented',type:'PERSON'}]})}}]}});
    await expect(preparePrivateText([{id:'s',text:'Иван не записан.'}],{findGlobal:async()=>[provider as never]})).rejects.toThrow('text_privacy_');
    expect(post).toHaveBeenCalledTimes(1);post.mockReset();
  });
  it('isolates a failed batch into one exact-source pass without keeping any rejected entities', async()=>{
    const post=jest.mocked(axios.post);post.mockReset();
    const input=[{id:'a',text:'Оператор Иван. Цена 3200.'},{id:'b',text:'Клиент Петров. Не записан.'}];
    post.mockImplementation(async(_url,raw:any)=>{
      const entries=JSON.parse(raw.messages[1].content).entries;
      const entities=entries.length===2?[{entryId:'a',quote:'Иван Петров',type:'PERSON'}]:[{entryId:entries[0].id,quote:entries[0].id==='a'?'Иван':'Петров',type:'PERSON'}];
      return {data:{model:provider.defaults.model,choices:[{finish_reason:'stop',message:{content:JSON.stringify({reviewedIds:entries.map((e:any)=>e.id),uncertain:false,entities})}}]}};
    });
    const result=await preparePrivateText(input,{findGlobal:async()=>[provider as never]});
    expect(post).toHaveBeenCalledTimes(3);
    expect(result.entries.map(e=>e.text)).toEqual(['Оператор [PERSON_1]. Цена 3200.','Клиент [PERSON_2]. Не записан.']);
    expect(result.receipt).toMatchObject({sourceSpanRepairCount:1,sourceSpanRepairRequests:2});
    post.mockReset();
  });
  it('preserves standalone yes/no misclassified as IDs while retaining actual names and identifiers', async()=>{
    const post=jest.mocked(axios.post);post.mockReset();
    const input=[{id:'a',text:'Да. Нет. Номер AB-42. Организация Да. Клиент Да.'}];
    post.mockResolvedValueOnce({data:{model:provider.defaults.model,choices:[{finish_reason:'stop',message:{content:JSON.stringify({reviewedIds:['a'],uncertain:false,entities:[
      {entryId:'a',quote:'Да.',type:'DOCUMENT'},{entryId:'a',quote:'Нет.',type:'IDENTIFIER'},
      {entryId:'a',quote:'AB-42',type:'IDENTIFIER'},{entryId:'a',quote:'Организация Да',type:'ORGANIZATION'},
      {entryId:'a',quote:'Клиент Да',type:'PERSON'},
    ]})}}]}});
    const result=await preparePrivateText(input,{findGlobal:async()=>[provider as never]});
    expect(result.entries[0].text).toBe('Да. Нет. Номер [IDENTIFIER_1]. [ORGANIZATION_2]. [PERSON_3].');
    expect(result.receipt.discardedGenericIdentifierCount).toBe(2);
    expect(post).toHaveBeenCalledTimes(1);post.mockReset();
  });
  it('preserves a misclassified appointment time while masking an actual same-format document ID',async()=>{
    const post=jest.mocked(axios.post);post.mockReset();
    const input=[{id:'a',text:'Перенесли запись на 8.30 утра.'},{id:'b',text:'Номер документа 9.45.'}];
    post.mockResolvedValueOnce({data:{model:provider.defaults.model,choices:[{finish_reason:'stop',message:{content:JSON.stringify({reviewedIds:['a','b'],uncertain:false,entities:[{entryId:'a',quote:'8.30',type:'IDENTIFIER'},{entryId:'b',quote:'9.45',type:'DOCUMENT'}]})}}]}});
    const result=await preparePrivateText(input,{findGlobal:async()=>[provider as never]});
    expect(result.entries.map(e=>e.text)).toEqual(['Перенесли запись на 8.30 утра.','Номер документа [DOCUMENT_1].']);
    expect(post).toHaveBeenCalledTimes(1);post.mockReset();
  });
  it('maps complete index decisions to immutable candidates without accepting model-supplied source pairs',async()=>{
    const post=coverageProvider(()=>({reviewedIds:['b'],uncertain:false,decisions:{d0:true}}));
    const result=await preparePrivateText(repeatedIdentifier,{findGlobal:async()=>[provider as never]});
    expect(result.entries[1].text).toBe('[IDENTIFIER_1] не отменена, цена 3200 рублей.');
    expect(post).toHaveBeenCalledTimes(2);post.mockReset();
  });
  it.each([{},{d0:true,d1:true},{d0:'yes'}])('fails closed for incomplete/foreign/nonboolean candidate decisions %j',async decisions=>{
    const post=coverageProvider(()=>({reviewedIds:['b'],uncertain:false,decisions}));
    await expect(preparePrivateText(repeatedIdentifier,{findGlobal:async()=>[provider as never]})).rejects.toThrow('text_privacy_coverage_outside_candidate');
    expect(post).toHaveBeenCalledTimes(2);post.mockReset();
  });
  it('accepts a complete explicit benign decision only for the reviewed source entry',async()=>{
    const input=[{id:'a',text:'Номер счета 3200.'},{id:'b',text:'Цена процедуры 3200 рублей.'}];
    const post=coverageProvider(()=>({reviewedIds:['b'],uncertain:false,decisions:{d0:false}}),input);
    const result=await preparePrivateText(input,{findGlobal:async()=>[provider as never]});
    expect(result.entries.map(e=>e.text)).toEqual(['Номер счета [ACCOUNT_1].','Цена процедуры 3200 рублей.']);
    expect(result.receipt).toMatchObject({benignReviewedCandidateCount:1,residualBefore:1,residualAfter:0});
    expect(result.sourceBindings[0].spans).toHaveLength(1);expect(result.sourceBindings[1].spans).toHaveLength(0);
    expect(post).toHaveBeenCalledTimes(2);post.mockReset();
  });
  it('does not honor a benign decision from an uncertain coverage response',async()=>{
    const post=coverageProvider(()=>({reviewedIds:['b'],uncertain:true,decisions:{d0:false}}));
    await expect(preparePrivateText(repeatedIdentifier,{findGlobal:async()=>[provider as never]})).rejects.toThrow('text_privacy_invalid_response');
    expect(post).toHaveBeenCalledTimes(2);post.mockReset();
  });
  it('does not review a numeric fragment inside a different number or a name inside another word',()=>{
    const masked=maskPrivacyEntries([{id:'a',text:'Номер 00. Иван.'},{id:'b',text:'Оценка 0-100. Иваново.'}],{reviewedIds:['a','b'],uncertain:false,entities:[{entryId:'a',quote:'00',type:'IDENTIFIER'},{entryId:'a',quote:'Иван',type:'PERSON'}]});
    expect(masked.getResiduals()).toEqual([]);expect(masked.entries[1].text).toBe('Оценка 0-100. Иваново.');
  });
  it('rejects duplicate source IDs before provider lookup', async () => {
    const findGlobal = jest.fn(async () => [provider as never]);
    await expect(preparePrivateText([
      { id: 'same', text: 'Цена 3200.' }, { id: 'same', text: 'Иван Петров.' },
    ], { findGlobal })).rejects.toThrow('text_privacy_input_limit');
    expect(findGlobal).not.toHaveBeenCalled();
  });
  it.each([
    { reviewedIds: ['a'], uncertain: false },
    { reviewedIds: ['a', 'b'], uncertain: true },
  ])('does not repair source references for an incomplete or uncertain review', async (review) => {
    jest.mocked(axios.post).mockResolvedValueOnce({ data: {
      model: provider.defaults.model, choices: [{ finish_reason: 'stop', message: { content: JSON.stringify({
        ...review, entities: [{ entryId: 'a', quote: 'Иван Петров', type: 'PERSON' }],
      }) } }],
    } });
    await expect(preparePrivateText([
      { id: 'a', text: 'Цена 3200.' }, { id: 'b', text: 'Иван Петров.' },
    ], { findGlobal: async () => [provider as never] })).rejects.toThrow('text_privacy_invalid_response');
  });
  it('protects project instructions and derived insight quotes while retaining schema IDs and numbers', async () => {
    jest.mocked(axios.post).mockImplementation(async (_url, body: any) => {
      const entries = JSON.parse(body.messages[1].content).entries;
      return {
        data: {
          model: 'qwen3.5:8b',
          choices: [
            {
              finish_reason: 'stop',
              message: {
                content: JSON.stringify({
                  reviewedIds: entries.map((e: any) => e.id),
                  uncertain: false,
                  entities: entries.flatMap((e: any) =>
                    e.text.includes('Иван Петров')
                      ? [
                          {
                            entryId: e.id,
                            quote: 'Иван Петров',
                            type: 'PERSON',
                          },
                        ]
                      : [],
                  ),
                }),
              },
            },
          ],
        },
      };
    });
    const config = defaultSaProjectConfig();
    config.insights.summary.instruction = 'Клиент Иван Петров';
    const prepared = await prepareAnalysisText(
      [{ text: 'Иван Петров не записан' }],
      config,
      { findGlobal: async () => [provider as never] },
    );
    expect(prepared.texts[0]).toBe('[PERSON_1] не записан');
    expect(prepared.config.insights.summary.instruction).not.toContain(
      'Иван Петров',
    );
    expect(prepared.config.metrics[0].id).toBe(config.metrics[0].id);
    expect(config.insights.summary.instruction).toBe('Клиент Иван Петров');
    const derived = await preparePrivateJson(
      { quotes: [{ text: 'Иван Петров', recordingId: 'opaque', score: 75 }] },
      { findGlobal: async () => [provider as never] },
    );
    expect(derived.quotes[0]).toEqual({
      text: '[PERSON_1]',
      recordingId: 'opaque',
      score: 75,
    });
  });
});

describe('privacy guards every analysis LLM step', () => {
  const config = {
    ...defaultSaProjectConfig(),
    textPrivacy: { anonymizeBeforeLlm: true },
  };
  const input: RunAnalysisInput = {
    runId: 'r',
    tenantUid: 1,
    audioPath: 'unused',
    audioMs: 2000,
    currency: 'RUB',
    channelSource: 'upload',
    swapChannels: false,
    channels: 1,
    stereoVerified: false,
    moduleDefaults: { sttModelId: 's', scoreModelId: 'l' },
    publishedVersionModels: { sttModelId: 's', scoreModelId: 'l' },
    platformAllowlist: ['s', 'l'],
    projectConfig: config,
  };
  const fixture = () => {
    const deps: RunAnalysisDeps = {
      stt: async () => ({
        segments: [{ start: 0, end: 1, text: 'Иван Петров не записан' }],
        text: 'Иван Петров не записан',
        durationSec: 2,
        providerTokens: 0,
        modelId: 's',
      }),
      diarize: jest.fn(async ({ segments }) => ({
        mode: 'llm_roles',
        requestSecondStt: false,
        segments: segments.map((s, i) => ({
          id: 's' + i,
          ordinal: i,
          startMs: s.start * 1000,
          endMs: s.end * 1000,
          channel: 0,
          speakerRole: 'unknown',
          roleSource: 'llm',
          text: s.text,
        })),
      })),
      score: jest.fn(async () => ({
        summary: '[PERSON_1] не записан',
        metrics: [],
        providerTokens: 1,
        modelId: 'l',
      })),
      persistSuccess: jest.fn(),
      persistError: jest.fn(),
      invokeSaChargeRun: jest.fn(),
      findLatestRates: async () => [],
      updateRunCharge: async () => undefined,
    };
    return deps;
  };
  it('does not call role labeling, scoring or charging when local processing fails', async () => {
    const deps = fixture();
    deps.prepareText = async () => {
      throw new Error('sensitive response');
    };
    await expect(runAnalysis(input, deps)).resolves.toEqual({
      state: 'error',
      reason: 'text_privacy_failed',
    });
    expect(deps.diarize).not.toHaveBeenCalled();
    expect(deps.score).not.toHaveBeenCalled();
    expect(deps.invokeSaChargeRun).not.toHaveBeenCalled();
  });
  it('uses prepared text for role labeling/scoring and retains authorized original transcript', async () => {
    const deps = fixture();
    deps.prepareText = async () => ({
      texts: ['[PERSON_1] не записан'],
      config,
      receipt: { kind: 'text_privacy' },
    });
    await expect(runAnalysis(input, deps)).resolves.toEqual({
      state: 'completed',
    });
    expect(deps.diarize).toHaveBeenCalledWith(
      expect.objectContaining({
        segments: [{ start: 0, end: 1, text: '[PERSON_1] не записан' }],
      }),
    );
    expect(deps.score).toHaveBeenCalledWith(
      expect.objectContaining({ transcript: 'unknown: [PERSON_1] не записан' }),
    );
    expect(deps.persistSuccess).toHaveBeenCalledWith(
      expect.objectContaining({
        summary: '[PERSON_1] не записан',
        segments: [expect.objectContaining({ text: 'Иван Петров не записан' })],
        evidence: [{ kind: 'text_privacy' }],
      }),
    );
  });
  it('restores originals when energy diarization merges adjacent segments', async () => {
    const deps = fixture();
    deps.stt = async () => ({
      segments: [
        { start: 0, end: 1, text: 'Иван Петров' },
        { start: 1, end: 2, text: 'не записан' },
      ],
      text: 'Иван Петров не записан',
      durationSec: 2,
      providerTokens: 0,
      modelId: 's',
    });
    const bound=maskPrivacyEntries([{id:'s0',text:'Иван Петров'},{id:'s1',text:'не записан'}],{reviewedIds:['s0','s1'],uncertain:false,entities:[{entryId:'s0',quote:'Иван Петров',type:'PERSON'}]});
    deps.prepareText = async () => ({
      texts: ['[PERSON_1]', 'не записан'],config,
      receipt: {kind:'text_privacy',transcriptBindings:{profile:'sa-transcript-spans-v1',segments:bound.sourceBindings.map(({entryId,...row})=>({ordinal:Number(entryId.slice(1)),...row}))}},
    });
    deps.diarize = async () => ({
      mode: 'energy',
      requestSecondStt: false,
      segments: [
        {
          id: 'merged',
          ordinal: 0,
          startMs: 0,
          endMs: 2000,
          channel: 0,
          speakerRole: 'customer',
          roleSource: 'channel_energy',
          text: '[PERSON_1] не записан',
        },
      ],
    });
    await expect(runAnalysis(input, deps)).resolves.toEqual({
      state: 'completed',
    });
    expect(deps.persistSuccess).toHaveBeenCalledWith(
      expect.objectContaining({
        segments: [
          expect.objectContaining({
            text: 'Иван Петров не записан',
            startMs: 0,
            endMs: 2000,
          }),
        ],
      }),
    );
    const patch=jest.mocked(deps.persistSuccess).mock.calls[0][0];
    expect(reuseTranscriptPrivacy(patch.segments.map(s=>({id:s.id,ordinal:s.ordinal,text:s.text})),patch.evidence).entries[0].text).toBe('[PERSON_1] не записан');
  });
});
