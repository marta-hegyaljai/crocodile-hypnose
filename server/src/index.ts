import { buildApp } from './app.ts';
import { loadConfig } from './config.ts';
import { SqliteAccountRepository } from './storage/sqlite.ts';

const config = loadConfig();
const repo = new SqliteAccountRepository(config.dbPath);
const app = await buildApp({ config, repo });

if (config.jwtSecretGenerated) {
  app.log.warn(
    'JWT_SECRET not set: using a random secret; access tokens end when the server restarts',
  );
}

let closing = false;
async function shutdown(signal: string) {
  if (closing) return;
  closing = true;
  app.log.info({ signal }, 'shutting down');
  await app.close();
  await repo.close();
  process.exit(0);
}
process.on('SIGINT', () => void shutdown('SIGINT'));
process.on('SIGTERM', () => void shutdown('SIGTERM'));

try {
  await app.listen({ host: config.host, port: config.port });
  app.log.info({ db: config.dbPath }, 'MHP dev account service ready');
} catch (err) {
  app.log.error(err);
  await repo.close();
  process.exit(1);
}
