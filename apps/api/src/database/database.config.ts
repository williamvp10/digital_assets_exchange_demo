import { PostgresConnectionOptions } from 'typeorm/driver/postgres/PostgresConnectionOptions';
import { ENTITIES } from './entities';

/** Misma configuración para NestJS, CLI, seed y pruebas; nunca sincronizar esquema automáticamente. */
export function databaseOptions(url: string | undefined): PostgresConnectionOptions {
  if (!url) throw new Error('DATABASE_URL is required');
  return {
    type: 'postgres',
    url,
    entities: ENTITIES,
    synchronize: false,
    uuidExtension: 'pgcrypto',
    installExtensions: false,
    extra: { max: 15 },
  };
}
