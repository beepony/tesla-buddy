import { FixtureRepository } from "./fixture-repository.mjs";
import { PostgresRepository } from "./postgres-repository.mjs";

/**
 * Returns the data source selected by configuration. PostgreSQL is intentionally
 * blocked until we inspect the installed TeslaMate version and grant a dedicated
 * read-only role; this avoids accidental writes or schema assumptions.
 */
export function createRepository(environment = process.env) {
  const source = environment.DATA_SOURCE ?? "mock";
  if (source === "mock") return new FixtureRepository();
  if (source === "postgres") {
    if (!environment.TESLAMATE_DATABASE_URL) throw new Error("TESLAMATE_DATABASE_URL is required when DATA_SOURCE=postgres.");
    return new PostgresRepository(environment.TESLAMATE_DATABASE_URL, environment.TESLA_BUDDY_MODEL_NAME ?? null);
  }
  throw new Error(`Unsupported DATA_SOURCE: ${source}`);
}
