import en from './en.json' assert { type: 'json' };

const dictionary: Record<string, string> = en;

export function l(key: string, fallback = ''): string {
  return dictionary[key] ?? fallback;
}
