// Readable BibTeX identifiers: first-author surname + year + first title word.
// Metadata absence stays explicit; no publication dates or authors are invented.
const slug = (value) =>
  String(value || "")
    .normalize("NFKD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");
export function citationKey({ authors = [], year, title }) {
  const author =
    slug(authors[0]?.family || authors[0]?.name).slice(0, 48) || "anonymous";
  const word = String(title || "")
    .replace(/<[^>]*>/g, "")
    .match(/[\p{L}\p{N}][\p{L}\p{N}'’-]*/u)?.[0];
  return `${author}${year || "nd"}${slug(word).slice(0, 48) || "untitled"}`;
}
export function uniqueCitationKey(key, occupied) {
  if (!occupied.has(key)) return key;
  for (let n = 0; n < 10000; n++) {
    let value = n;
    let suffix = "";
    do {
      suffix = String.fromCharCode(97 + (value % 26)) + suffix;
      value = Math.floor(value / 26) - 1;
    } while (value >= 0);
    if (!occupied.has(key + suffix)) return key + suffix;
  }
  throw new Error("Too many references with the same citation key");
}
