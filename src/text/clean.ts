// Step 1 (ARCHITECTURE.md): deterministic, per-line cleaning. No judgement about content.

export type CleanResult = {
  lines: string[];
  text: string;
  dropped: { reason: 'empty' | 'duplicate' | 'trivial'; line: string }[];
};

const IMAGE = /!\[([^\]]*)\]\([^)]*\)/g;
const LINK = /\[([^\]]*)\]\([^)]*\)/g;
const PLACEHOLDER_URL = /https?:\/\/[^\s)]*placehold[^\s)]*/g;

export function cleanLine(raw: string): string {
  return raw
    .replace(IMAGE, '$1') // keep alt text; the image itself is a placeholder
    .replace(PLACEHOLDER_URL, '')
    .replace(LINK, '$1')
    .replace(/\s+/g, ' ')
    .trim();
}

const dedupeKey = (line: string) => line.toLowerCase();
const isTrivial = (line: string) => line.length < 2 || !/[\p{L}\p{N}]/u.test(line);

export function clean(markdown: string): CleanResult {
  const seen = new Set<string>();
  const lines: string[] = [];
  const dropped: CleanResult['dropped'] = [];
  for (const raw of markdown.split('\n')) {
    const line = cleanLine(raw);
    if (!line) {
      if (raw.trim()) dropped.push({ reason: 'empty', line: raw.trim() });
      continue;
    }
    if (isTrivial(line)) {
      dropped.push({ reason: 'trivial', line });
      continue;
    }
    const key = dedupeKey(line);
    if (seen.has(key)) {
      dropped.push({ reason: 'duplicate', line });
      continue;
    }
    seen.add(key);
    lines.push(line);
  }
  return { lines, text: lines.join('\n'), dropped };
}
