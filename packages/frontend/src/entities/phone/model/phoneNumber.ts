export function dialableNumber(value: string | null | undefined): string | null {
  if (!value || value.length > 64 || /[^+\d\s().*#-]/u.test(value)) return null;
  const number = value.replace(/[\s().-]/g, '');
  return /^(?:\+?\d[\d*#]*|\*\d[\d*#]*)$/.test(number) ? number : null;
}

export function formatPhoneNumber(value: string): string {
  const number = dialableNumber(value);
  const digits = number?.replace(/^\+/, '');
  return digits && /^7\d{10}$/.test(digits)
    ? `+7 ${digits.slice(1, 4)} ${digits.slice(4, 7)}-${digits.slice(7, 9)}-${digits.slice(9)}`
    : value;
}

export function phoneHistoryHref(number: string): string {
  const safe = dialableNumber(number);
  if (!safe) throw new Error('Invalid phone number');
  return '/reports/calls?' + new URLSearchParams({ search: safe, dateFrom: '', dateTo: '' });
}
