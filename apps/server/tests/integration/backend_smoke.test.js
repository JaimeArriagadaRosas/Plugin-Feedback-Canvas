import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { PostgreSqlContainer } from '@testcontainers/postgresql';
import pg from 'pg';

// Opt-in: never connect to production or the normal local application database.
const describeDocker = process.env.RUN_DOCKER_TESTS === 'true' ? describe : describe.skip;

describeDocker('Backend PostgreSQL isolated integration', () => {
  let pgContainer;
  let isolatedPool;

  beforeAll(async () => {
    pgContainer = await new PostgreSqlContainer('postgres:15-alpine')
      .withDatabase('test_db')
      .withUsername('test_user')
      .withPassword('test_pass')
      .start();
    isolatedPool = new pg.Pool({ connectionString: pgContainer.getConnectionUri(),
      connectionTimeoutMillis: 5000, max: 2 });
  }, 120000);

  afterAll(async () => {
    if (isolatedPool) await isolatedPool.end();
    if (pgContainer) await pgContainer.stop();
  });

  it('queries a disposable database without touching the configured database', async () => {
    const { rows } = await isolatedPool.query('SELECT current_database() AS database_name, 1 AS health');
    expect(rows).toEqual([{ database_name: 'test_db', health: 1 }]);
    expect(pgContainer.getPort()).toBeGreaterThan(0);
  });
});
