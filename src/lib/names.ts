/**
 * Tidies a name as it is saved: spaces collapsed, and a word or a whole name
 * typed twice kept once. "beyza diker diker" becomes "beyza diker", and
 * "Ayşe Yılmaz Ayşe Yılmaz" (the name Google filled in, typed again after
 * it) becomes "Ayşe Yılmaz". Words are compared ignoring case, the Turkish
 * way (so I and ı, İ and i pair correctly); the first spelling is kept.
 */
export function cleanName(raw: string): string {
  const key = (w: string) => w.toLocaleLowerCase("tr");
  const words = raw.trim().split(/\s+/).filter(Boolean);

  const once: string[] = [];
  for (const word of words) {
    if (once.length && key(once[once.length - 1]) === key(word)) continue;
    once.push(word);
  }

  // The whole name repeated: the first half matches the second.
  if (once.length >= 2 && once.length % 2 === 0) {
    const half = once.length / 2;
    if (once.slice(0, half).every((w, i) => key(w) === key(once[half + i]))) return once.slice(0, half).join(" ");
  }
  return once.join(" ");
}
