import 'reflect-metadata';
import './env';
import { DataSource } from 'typeorm';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { databaseOptions } from './database.config';

/** Inicializa el esquema definido desde el inicio. Repetirlo no borra datos ni financia saldos. */
export async function initializeSchema(dataSource: DataSource) {
  const sql = readFileSync(resolve(__dirname, '../../../../database/schema.sql'), 'utf8');
  await dataSource.transaction(async (manager) => {
    await manager.query("SELECT pg_advisory_xact_lock(hashtextextended('assets:initialize',0))");
    await manager.query(sql);
  });
}
if (require.main === module) {
  const dataSource = new DataSource(databaseOptions(process.env.DATABASE_URL));
  dataSource
    .initialize()
    .then(() => initializeSchema(dataSource))
    .then(() => console.log('Schema ready'))
    .catch((error) => {
      console.error(error);
      process.exitCode = 1;
    })
    .finally(async () => {
      if (dataSource.isInitialized) await dataSource.destroy();
    });
}
