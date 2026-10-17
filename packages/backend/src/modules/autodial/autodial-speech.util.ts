const ones = ['', 'один', 'два', 'три', 'четыре', 'пять', 'шесть', 'семь', 'восемь', 'девять'];
const teens = ['десять', 'одиннадцать', 'двенадцать', 'тринадцать', 'четырнадцать', 'пятнадцать', 'шестнадцать', 'семнадцать', 'восемнадцать', 'девятнадцать'];
const tens = ['', '', 'двадцать', 'тридцать', 'сорок', 'пятьдесят', 'шестьдесят', 'семьдесят', 'восемьдесят', 'девяносто'];
const hundreds = ['', 'сто', 'двести', 'триста', 'четыреста', 'пятьсот', 'шестьсот', 'семьсот', 'восемьсот', 'девятьсот'];
const digits = ['ноль', ...ones.slice(1)];
const plural = (n: number, forms: string[]) => n % 100 >= 11 && n % 100 <= 14 ? forms[2] : n % 10 === 1 ? forms[0] : n % 10 >= 2 && n % 10 <= 4 ? forms[1] : forms[2];
function chunk(n: number, female: boolean): string {
  const units = female ? ['', 'одна', 'две', ...ones.slice(3)] : ones;
  return [hundreds[Math.floor(n / 100)], n % 100 < 20 && n % 100 >= 10 ? teens[n % 100 - 10]
    : [tens[Math.floor(n % 100 / 10)], units[n % 10]].filter(Boolean).join(' ')].filter(Boolean).join(' ');
}
export function russianAutodialInteger(value: number, female = false): string {
  if (!Number.isSafeInteger(value) || Math.abs(value) >= 1e15) throw new Error('AC_SPEECH_RANGE');
  if (!value) return 'ноль';
  const scales = [[], ['тысяча', 'тысячи', 'тысяч'], ['миллион', 'миллиона', 'миллионов'],
    ['миллиард', 'миллиарда', 'миллиардов'], ['триллион', 'триллиона', 'триллионов']];
  const result: string[] = []; let n = Math.abs(value), scale = 0;
  while (n) { const part = n % 1000;
    if (part) result.unshift([chunk(part, scale === 1 || (scale === 0 && female)), scale ? plural(part, scales[scale]) : ''].filter(Boolean).join(' '));
    n = Math.floor(n / 1000); scale++;
  }
  return (value < 0 ? 'минус ' : '') + result.join(' ');
}
const months = ['января', 'февраля', 'марта', 'апреля', 'мая', 'июня', 'июля', 'августа', 'сентября', 'октября', 'ноября', 'декабря'];
const ordinal = ['нулевого', 'первого', 'второго', 'третьего', 'четвёртого', 'пятого', 'шестого', 'седьмого', 'восьмого', 'девятого',
  'десятого', 'одиннадцатого', 'двенадцатого', 'тринадцатого', 'четырнадцатого', 'пятнадцатого', 'шестнадцатого', 'семнадцатого', 'восемнадцатого', 'девятнадцатого'];
function ordinalGenitive(n: number): string {
  if (n < 20) return ordinal[n];
  return n % 10 ? `${tens[Math.floor(n / 10)]} ${ordinal[n % 10]}`
    : ({ 20: 'двадцатого', 30: 'тридцатого', 40: 'сорокового', 50: 'пятидесятого', 60: 'шестидесятого', 70: 'семидесятого', 80: 'восьмидесятого', 90: 'девяностого' } as Record<number, string>)[n];
}
export type AutodialSpeechKind = 'money' | 'date' | 'number' | 'digits';
export function autodialSpeech(value: string | number | boolean, kind: AutodialSpeechKind, currency = 'RUB'): string {
  if (kind === 'digits') return String(value).split('').map((char) => /\d/.test(char) ? digits[Number(char)] : char === '-' ? 'минус' : '').filter(Boolean).join(' ');
  if (kind === 'date') {
    const text = String(value), date = new Date(text + 'T00:00:00Z');
    if (!/^\d{4}-\d{2}-\d{2}$/.test(text) || !Number.isFinite(date.getTime()) || date.toISOString().slice(0, 10) !== text) throw new Error('AC_SPEECH_DATE');
    const year = date.getUTCFullYear();
    const spokenYear = year === 2000 ? 'двухтысячного' : year === 1900 ? 'тысяча девятисотого'
      : year === 2100 ? 'две тысячи сотого' : year > 1900 && year < 2100
        ? `${year < 2000 ? 'тысяча девятьсот' : 'две тысячи'} ${ordinalGenitive(year % 100)}` : russianAutodialInteger(year);
    return `${ordinalGenitive(date.getUTCDate())} ${months[date.getUTCMonth()]} ${spokenYear} года`;
  }
  const number = typeof value === 'boolean' ? NaN : Number(String(value).replace(/[\s\u00a0\u202f]/g, '').replace(',', '.'));
  if (!Number.isFinite(number) || !String(value).trim()) throw new Error('AC_SPEECH_NUMBER');
  if (kind === 'number') {
    if (Number.isInteger(number)) return russianAutodialInteger(number);
    const [whole, fraction] = String(Math.abs(number)).split('.');
    if (!fraction || /e/i.test(fraction) || /e/i.test(whole)) throw new Error('AC_SPEECH_RANGE');
    return `${number < 0 ? 'минус ' : ''}${russianAutodialInteger(Number(whole))} запятая ${autodialSpeech(fraction, 'digits')}`;
  }
  const cents = Math.round(Math.abs(number) * 100); if (!Number.isSafeInteger(cents)) throw new Error('AC_SPEECH_RANGE');
  const units = Math.floor(cents / 100), fraction = cents % 100;
  const unitForms = currency === 'USD' ? ['доллар', 'доллара', 'долларов'] : currency === 'EUR' ? ['евро', 'евро', 'евро'] : ['рубль', 'рубля', 'рублей'];
  const centForms = currency === 'RUB' ? ['копейка', 'копейки', 'копеек'] : ['цент', 'цента', 'центов'];
  return `${number < 0 ? 'минус ' : ''}${russianAutodialInteger(units)} ${plural(units, unitForms)} ${russianAutodialInteger(fraction, currency === 'RUB')} ${plural(fraction, centForms)}`;
}
