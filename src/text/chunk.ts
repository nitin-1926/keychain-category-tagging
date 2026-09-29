// STEP 2 (ARCHITECTURE.md section 3): cleaned lines -> ~1,000-char chunks. A heading starts a new
// chunk; a single oversize line is split at sentence ends. Chunks keep site order.
// Called by: pipeline/tag.ts, right after text/clean.ts.
// Its output feeds two places: pipeline/profile.ts groups chunks into model-sized windows (step 3),
// and pipeline/judge.ts picks individual chunks as evidence (step 7).

export type Chunk = { index: number; text: string; charStart: number };

const HEADING = /^#{1,6}\s/;
const SENTENCE_END = /(?<=[.!?])\s+/;

function splitLong(line: string, max: number): string[] {
  if (line.length <= max) return [line];
  const out: string[] = [];
  let cur = '';
  for (const sentence of line.split(SENTENCE_END)) {
    if (cur && cur.length + sentence.length + 1 > max) {
      out.push(cur);
      cur = '';
    }
    cur = cur ? `${cur} ${sentence}` : sentence;
  }
  if (cur) out.push(cur);
  return out;
}

export function chunk(lines: string[], target = 1_000): Chunk[] {
  const chunks: Chunk[] = [];
  let buf: string[] = [];
  let bufStart = 0;
  let offset = 0; // position in lines.join('\n')

  const flush = () => {
    if (buf.length) chunks.push({ index: chunks.length, text: buf.join('\n'), charStart: bufStart });
    buf = [];
  };

  for (const line of lines) {
    if (HEADING.test(line)) flush();
    for (const piece of splitLong(line, target * 1.2)) {
      const size = buf.reduce((n, l) => n + l.length + 1, 0);
      if (buf.length && size + piece.length > target) flush();
      if (!buf.length) bufStart = offset;
      buf.push(piece);
      offset += piece.length + 1;
    }
  }
  flush();
  return chunks;
}
