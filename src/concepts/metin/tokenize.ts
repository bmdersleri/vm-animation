/** "değil" as a stop word: the setting that flips "kötü değil" (the generator's models drop it). */
export const DEGIL_STOP: ReadonlySet<string> = new Set(['değil']);

/**
 * The book's code 01 cleaning, without the split: "İ" -> "i", "I" -> "ı", lower-case, every
 * character that is not a Turkish lower-case letter or white space becomes a space. It is the
 * `preprocessor` of every vectoriser of the generator (scripts/make_metin_data.py).
 */
export function clean(text: string): string {
  return text
    .replace(/İ/g, 'i')
    .replace(/I/g, 'ı')
    .toLowerCase()
    .replace(/[^a-zçğıöşü\s]/g, ' ');
}

/**
 * The book's tokenizer (code 01): clean, split on white space, drop one-character tokens; then
 * the stop words move from `tokens` to `dropped`, both in text order.
 */
export function tokenize(
  text: string,
  stopWords?: ReadonlySet<string>,
): { tokens: string[]; dropped: string[] } {
  const words = clean(text).split(/\s+/).filter(word => word.length > 1);
  const tokens: string[] = [];
  const dropped: string[] = [];
  for (const word of words) {
    if (stopWords !== undefined && stopWords.has(word)) {
      dropped.push(word);
    } else {
      tokens.push(word);
    }
  }
  return { tokens, dropped };
}
