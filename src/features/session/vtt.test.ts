import { cueAt, parseVtt } from './vtt';

const SAMPLE = `WEBVTT

NOTE a comment

1
00:00:01.000 --> 00:00:04.500
<v Guide>[Caption 1]</v>

00:00:05.000 --> 00:00:08.000 align:center
[Caption 2]
second line

00:00:09.000 --> 00:00:08.000
broken
`;

describe('vtt', () => {
  it('parses cues, strips tags, skips notes and broken cues', () => {
    expect(parseVtt(SAMPLE)).toEqual([
      { start: 1, end: 4.5, text: '[Caption 1]' },
      { start: 5, end: 8, text: '[Caption 2]\nsecond line' },
    ]);
  });

  it('finds the cue for a time', () => {
    const cues = parseVtt(SAMPLE);
    expect(cueAt(cues, 0.5)).toBeNull();
    expect(cueAt(cues, 2)?.text).toBe('[Caption 1]');
    expect(cueAt(cues, 4.6)).toBeNull();
    expect(cueAt(cues, 7.9)?.text).toBe('[Caption 2]\nsecond line');
  });
});
