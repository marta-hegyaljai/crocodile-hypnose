import { crocColors } from '../croc/colors';
import { buildCroc, peekWaterlineRatio } from '../croc/geometry';
import { fitPeekCroc } from './peekFit';

const aboveFor = (width: number) => {
  const d = buildCroc({
    stage: 'juvenile',
    expression: 'happy',
    pose: 'peek',
    colors: crocColors('daylight'),
  });
  return width * peekWaterlineRatio(d) * (d.viewBox.h / d.viewBox.w);
};

describe('fitPeekCroc', () => {
  it('keeps the head below the content above and water above the content below', () => {
    const fit = fitPeekCroc({
      stage: 'juvenile',
      expression: 'happy',
      top: 200,
      bottom: 420,
      maxWidth: 460,
    });
    expect(fit.waterY - aboveFor(fit.crocWidth)).toBeGreaterThanOrEqual(200 + 16 - 1);
    expect(420 - fit.waterY).toBeGreaterThanOrEqual(40 - 1);
  });

  it('uses the full width when there is plenty of room', () => {
    const fit = fitPeekCroc({
      stage: 'juvenile',
      expression: 'happy',
      top: 100,
      bottom: 900,
      maxWidth: 400,
    });
    expect(fit.crocWidth).toBe(400);
  });

  it('never shrinks below the minimum', () => {
    const fit = fitPeekCroc({
      stage: 'juvenile',
      expression: 'happy',
      top: 300,
      bottom: 320,
      maxWidth: 400,
      minWidth: 150,
    });
    expect(fit.crocWidth).toBe(150);
  });
});
