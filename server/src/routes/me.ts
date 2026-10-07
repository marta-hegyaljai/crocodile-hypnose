import type { FastifyInstance, FastifyRequest } from 'fastify';

import type { AuthService } from '../auth-service.ts';
import {
  bodySchemaFor,
  checkDocumentRules,
  DOCUMENT_KINDS,
  moodConsentWithdrawn,
  PROGRESS_BODY_LIMIT,
  resolveDocument,
  withoutMoods,
  type DocumentKind,
} from '../documents.ts';
import { ApiError, errors } from '../errors.ts';
import {
  bodySchemaForStream,
  decideEvent,
  EVENT_STREAMS,
  EVENTS_READ_LIMIT,
  MAX_EVENTS_PER_STREAM,
  STREAM_FIELD,
  toRecords,
  wireEvent,
} from '../events.ts';
import type { DocumentRecord } from '../storage/repository.ts';

function bearer(req: FastifyRequest): string {
  const header = req.headers.authorization;
  const match = header ? /^Bearer\s+(\S+)$/i.exec(header) : null;
  if (!match?.[1]) throw errors.unauthorized();
  return match[1];
}

export interface MeRouteOptions {
  service: AuthService;
  now?: () => number;
  /** Per client address on the event streams' POST routes. */
  eventsRateLimit?: { max: number; timeWindow: number };
  rateLimit: { max: number; timeWindow: number };
}

/** What the app sees of a stored document: the body it wrote, plus when the server stored it. */
function wire(record: DocumentRecord | null) {
  return record ? { ...record.data, storedAt: record.storedAt } : null;
}

export async function meRoutes(
  app: FastifyInstance,
  { service, now = Date.now, rateLimit, eventsRateLimit }: MeRouteOptions,
) {
  const repo = service.repo;

  app.get('/me', async (req) => {
    const { user } = await service.authenticate(bearer(req));
    return { user: await service.profile(user) };
  });

  // Deletes the MHP account and all of its Hypnose data. Every session in every app ends.
  // Needs the password again (recent authentication), so a stolen or left-open session cannot
  // delete the account.
  app.delete<{ Body: { password: string } }>(
    '/me',
    {
      config: { rateLimit },
      schema: {
        body: {
          type: 'object',
          required: ['password'],
          properties: { password: { type: 'string', maxLength: 1024 } },
        },
      },
    },
    async (req, reply) => {
      const { user } = await service.authenticate(bearer(req));
      await service.confirmPassword(user, req.body.password);
      await service.deleteAccount(user.id);
      req.log.info({ userId: user.id }, 'account deleted');
      return reply.code(204).send();
    },
  );

  // Per-user app documents: GET returns the stored document (or null), PUT stores the whole
  // document, last write wins on `updatedAt`, and answers with what is stored afterwards.
  for (const kind of DOCUMENT_KINDS) {
    app.get(`/me/${kind}`, async (req) => {
      const { user } = await service.authenticate(bearer(req));
      return { [kind]: wire(await repo.getDocument(user.id, kind)) };
    });

    app.put<{ Body: Record<string, unknown> & { version: number; updatedAt: number } }>(
      `/me/${kind}`,
      {
        schema: { body: bodySchemaFor(kind) },
        // Progress is the only document that grows with use; the others keep the global limit.
        ...(kind === 'progress' ? { bodyLimit: PROGRESS_BODY_LIMIT } : {}),
      },
      async (req) => {
        const { user } = await service.authenticate(bearer(req));
        const at = now();
        let data = checkDocumentRules(kind as DocumentKind, req.body, at);
        if (kind === 'onboarding') {
          // Consent withdrawn in the settings: a stale copy's moods are not stored (and not
          // refused either, so that device does not retry forever; it takes the scrubbed copy).
          const settings = await repo.getDocument(user.id, 'settings');
          if (settings && moodConsentWithdrawn(settings.data)) data = withoutMoods(data) ?? data;
        }
        const incoming = {
          userId: user.id,
          kind,
          version: req.body.version,
          data,
          updatedAt: data.updatedAt as number,
          storedAt: at,
        };
        let consentBefore = null as boolean | null;
        const stored = await repo.putDocument(incoming, (current) => {
          consentBefore = current ? current.data.moodConsent === true : null;
          const resolved = resolveDocument(kind as DocumentKind, current?.data ?? null, data);
          return resolved
            ? { ...incoming, updatedAt: Number(resolved.updatedAt), data: resolved }
            : null;
        });
        // Consent withdrawn by this write: whatever mood data is still stored goes with it, even
        // when the app's own delete call never arrived (offline, closed). Only on the change
        // itself: a write that leaves consent off (or a stale copy that says off) purges nothing.
        if (kind === 'settings' && consentBefore !== false && moodConsentWithdrawn(stored.data)) {
          await purgeMood(user.id);
        }
        return { [kind]: wire(stored) };
      },
    );
  }

  /**
   * Deletes the user's mood data: the check-in stream and the moods held in the onboarding
   * document (health data). Idempotent.
   */
  async function purgeMood(userId: string): Promise<void> {
    await repo.deleteEvents(userId, 'mood');
    const onboarding = await repo.getDocument(userId, 'onboarding');
    if (onboarding && withoutMoods(onboarding.data)) {
      await repo.putDocument(onboarding, (current) => {
        const data = current ? withoutMoods(current.data) : null;
        return current && data ? { ...current, updatedAt: Number(data.updatedAt), data } : null;
      });
    }
  }

  app.delete('/me/mood', async (req, reply) => {
    const { user } = await service.authenticate(bearer(req));
    await purgeMood(user.id);
    return reply.code(204).send();
  });

  // Everything the server holds about the user, as one JSON document (data export).
  app.get('/me/export', async (req) => {
    const { user } = await service.authenticate(bearer(req));
    const documents: Record<string, unknown> = {};
    for (const kind of DOCUMENT_KINDS) {
      documents[kind] = wire(await repo.getDocument(user.id, kind));
    }
    const stream = async (name: (typeof EVENT_STREAMS)[number]) =>
      (await repo.listEvents(user.id, name, MAX_EVENTS_PER_STREAM)).map(wireEvent);
    return {
      exportedAt: new Date(now()).toISOString(),
      account: await service.profile(user),
      documents,
      sessionEvents: await stream('events'),
      moodEntries: await stream('mood'),
    };
  });

  /** Mood data may be stored only while the user agrees to it (settings, else onboarding). */
  async function moodConsent(userId: string): Promise<boolean> {
    const settings = await repo.getDocument(userId, 'settings');
    if (settings) return settings.data.moodConsent === true;
    const onboarding = await repo.getDocument(userId, 'onboarding');
    return onboarding?.data.moodConsent === true;
  }

  // Append-only event streams: GET returns the latest events (oldest first), POST appends a batch
  // (an id already stored is kept as it is) and answers with what is stored for each sent id.
  for (const stream of EVENT_STREAMS) {
    const field = STREAM_FIELD[stream];
    app.get(`/me/${stream}`, async (req) => {
      const { user } = await service.authenticate(bearer(req));
      const list = await repo.listEvents(user.id, stream, EVENTS_READ_LIMIT);
      return { [field]: list.map(wireEvent) };
    });

    app.post<{ Body: Record<string, Record<string, unknown>[]> }>(
      `/me/${stream}`,
      {
        schema: { body: bodySchemaForStream(stream) },
        ...(eventsRateLimit ? { config: { rateLimit: eventsRateLimit } } : {}),
      },
      async (req) => {
        const { user } = await service.authenticate(bearer(req));
        if (stream === 'mood' && !(await moodConsent(user.id))) {
          throw new ApiError(403, 'consent_required', 'Mood check-ins need the user’s consent.');
        }
        const records = toRecords(user.id, stream, req.body[field] ?? [], now());
        const stored = await repo.appendEvents(user.id, stream, records, (event, current) =>
          decideEvent(stream, event, current),
        );
        return { [field]: stored.map(wireEvent) };
      },
    );
  }
}
