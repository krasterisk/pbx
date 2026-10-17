import { autodialSpeech } from './autodial-speech.util';
describe('Russian autodial speech', () => {
  it.each([[1, 'один рубль ноль копеек'], [2, 'два рубля ноль копеек'], [5, 'пять рублей ноль копеек'],
    [11, 'одиннадцать рублей ноль копеек'], [21.21, 'двадцать один рубль двадцать одна копейка'],
    [15240.5, 'пятнадцать тысяч двести сорок рублей пятьдесят копеек'], [-1.02, 'минус один рубль две копейки']])('speaks %s with currency declensions', (value, expected) => {
    expect(autodialSpeech(value, 'money')).toBe(expected);
  });
  it('speaks civil dates, numbers and leading-zero identifiers', () => {
    expect(autodialSpeech('2026-10-16', 'date')).toBe('шестнадцатого октября две тысячи двадцать шестого года');
    expect(autodialSpeech('000505', 'digits')).toBe('ноль ноль ноль пять ноль пять');
    expect(autodialSpeech(2001, 'number')).toBe('две тысячи один');
  });
  it('rejects invalid calendar dates and unrepresentable amounts', () => {
    expect(() => autodialSpeech('2026-02-30', 'date')).toThrow('AC_SPEECH_DATE');
    expect(() => autodialSpeech('unknown', 'money')).toThrow('AC_SPEECH_NUMBER');
    expect(() => autodialSpeech(1e20, 'number')).toThrow('AC_SPEECH_RANGE');
  });
});
