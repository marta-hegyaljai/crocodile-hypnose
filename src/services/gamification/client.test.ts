import { createHttpGamificationClient, PurchaseRefused } from './client';
import { emptySummary } from './types';

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  });

const refusal = (code: string, message: string) => json({ error: { code, message } }, 409);

function clientAnswering(res: Response) {
  return createHttpGamificationClient({
    baseUrl: 'http://api',
    fetch: (async () => res.clone()) as typeof fetch,
  });
}

describe('http gamification client', () => {
  it('maps a refused purchase by the server’s error code, whatever the message says', async () => {
    // The wording is deliberately swapped: only the code counts.
    await expect(
      clientAnswering(
        refusal('insufficient_points', 'This decoration is not unlocked yet.'),
      ).purchase('lotus', 't'),
    ).rejects.toEqual(expect.objectContaining({ reason: 'insufficient' }));
    await expect(
      clientAnswering(refusal('locked', 'Not enough points.')).purchase('turtle', 't'),
    ).rejects.toEqual(expect.objectContaining({ reason: 'locked' }));
    await expect(
      clientAnswering(refusal('locked', 'x')).purchase('turtle', 't'),
    ).rejects.toBeInstanceOf(PurchaseRefused);
  });

  it('a 409 with a code it does not know is not a refusal reason', async () => {
    await expect(
      clientAnswering(refusal('something_new', 'unlock')).purchase('turtle', 't'),
    ).rejects.not.toBeInstanceOf(PurchaseRefused);
  });

  it('reads the points summary', async () => {
    const summary = emptySummary();
    expect(await clientAnswering(json({ points: summary })).points('t')).toEqual(summary);
  });
});
