// Load only the installed Russian stemmer, without natural's unrelated sentiment/DB modules.
declare module "natural/lib/natural/stemmers/porter_stemmer_ru" {
  const stemmer: { stem(word: string): string };
  export = stemmer;
}
