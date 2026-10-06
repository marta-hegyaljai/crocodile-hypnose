/** A caption cue from a WebVTT file. Times in seconds. */
export interface Cue {
  start: number;
  end: number;
  text: string;
}

const TIME = /(?:(\d+):)?(\d{1,2}):(\d{2})[.,](\d{3})/;

function seconds(stamp: string): number | null {
  const m = TIME.exec(stamp);
  if (!m) return null;
  return Number(m[1] ?? 0) * 3600 + Number(m[2]) * 60 + Number(m[3]) + Number(m[4]) / 1000;
}

/**
 * Parses the cues of a WebVTT file (enough for captions: timings and text, tags stripped). Notes,
 * styles and malformed blocks are skipped.
 */
export function parseVtt(source: string): Cue[] {
  const blocks = source.replace(/\r\n?/g, '\n').split(/\n{2,}/);
  const cues: Cue[] = [];
  for (const block of blocks) {
    const lines = block.split('\n').filter((l) => l.length > 0);
    const at = lines.findIndex((l) => l.includes('-->'));
    if (at < 0) continue;
    const [from, to] = lines[at]!.split('-->');
    const start = seconds(from ?? '');
    const end = seconds(to ?? '');
    if (start === null || end === null || end <= start) continue;
    const text = lines
      .slice(at + 1)
      .join('\n')
      .replace(/<[^>]+>/g, '')
      .trim();
    if (text) cues.push({ start, end, text });
  }
  return cues.sort((a, b) => a.start - b.start);
}

/** The caption to show at `time`, if any. */
export function cueAt(cues: readonly Cue[], time: number): Cue | null {
  for (const cue of cues) {
    if (cue.start > time) break;
    if (time < cue.end) return cue;
  }
  return null;
}
