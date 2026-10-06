import type { FastifyInstance, FastifyRequest } from 'fastify';

import type { AuthService } from '../auth-service.ts';
import {
  bodySchemaFor,
  checkDocumentRules,
  DOCUMENT_KINDS,
  resolveDocument,
  type DocumentKind,
} from '../documents.ts';
import { errors } from '../errors.ts';
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
}

/** What the app sees of a stored document: the body it wrote, plus when the server stored it. */
function wire(record: DocumentRecord | null) {
  return record ? { ...record.data, storedAt: record.storedAt } : null;
}

export async function meRoutes(app: FastifyInstance, { service, now = Date.now }: MeRouteOptions) {
  const repo = service.repo;

  app.get('/me', async (req) => {
    const { user } = await service.authenticate(bearer(req));
    return { user: await service.profile(user) };
  });

  // Deletes the MHP account and all of its Hypnose data. Every session in every app ends.
  app.delete('/me', async (req, reply) => {
    const { user } = await service.authenticate(bearer(req));
    await service.deleteAccount(user.id);
    req.log.info({ userId: user.id }, 'account deleted');
    return reply.code(204).send();
  });

  // Per-user app documents: GET returns the stored document (or null), PUT stores the whole
  // document, last write wins on `updatedAt`, and answers with what is stored afterwards.
  for (const kind of DOCUMENT_KINDS) {
    app.get(`/me/${kind}`, async (req) => {
      const { user } = await service.authenticate(bearer(req));
      return { [kind]: wire(await repo.getDocument(user.id, kind)) };
    });

    app.put<{ Body: Record<string, unknown> & { version: number; updatedAt: number } }>(
      `/me/${kind}`,
      { schema: { body: bodySchemaFor(kind) } },
      async (req) => {
        const { user } = await service.authenticate(bearer(req));
        const at = now();
        const data = checkDocumentRules(kind as DocumentKind, req.body, at);
        const incoming = {
          userId: user.id,
          kind,
          version: req.body.version,
          data,
          updatedAt: data.updatedAt as number,
          storedAt: at,
        };
        const stored = await repo.putDocument(incoming, (current) => {
          const resolved = resolveDocument(kind as DocumentKind, current?.data ?? null, data);
          return resolved ? { ...incoming, data: resolved } : null;
        });
        return { [kind]: wire(stored) };
      },
    );
  }
}
