import 'reflect-metadata';
import { DataSource } from 'typeorm';
import { randomUUID } from 'node:crypto';
import { databaseOptions } from '../src/database/database.config';
import { initializeSchema } from '../src/database/initialize';
import { seed } from '../src/database/seed';
import { Wallet } from '../src/database/entities/wallet.entity';
import { WalletAsset } from '../src/database/entities/wallet-asset.entity';
import { Asset } from '../src/database/entities/asset.entity';
import { LedgerEntry } from '../src/database/entities/ledger-entry.entity';

/** Schemas temporales aíslan pruebas de inicialización de los datos usados por las pruebas HTTP. */
describe('SQL initialization and TypeORM seed — real PostgreSQL', () => {
  let dataSource: DataSource;
  let schema: string;
  beforeEach(async () => {
    const url =
      process.env.TEST_DATABASE_URL || 'postgresql://sandbox:sandbox@localhost:55432/assets_test';
    if (!new URL(url).pathname.endsWith('_test'))
      throw new Error('Dedicated test database required');
    schema = `initialization_${randomUUID().replaceAll('-', '')}`;
    const admin = await new DataSource(databaseOptions(url)).initialize();
    try {
      await admin.query(`CREATE SCHEMA "${schema}"`);
    } finally {
      await admin.destroy();
    }
    const options = databaseOptions(url);
    dataSource = await new DataSource({
      ...options,
      schema,
      extra: { ...options.extra, options: `-c search_path=${schema}` },
    }).initialize();
  });
  afterEach(async () => {
    if (dataSource?.isInitialized) {
      await dataSource.query(`DROP SCHEMA "${schema}" CASCADE`);
      await dataSource.destroy();
    }
  });

  it('initializes the complete schema from scratch', async () => {
    await initializeSchema(dataSource);
    await seed(dataSource);
    expect(await dataSource.getRepository(Asset).count()).toBe(2);
    expect(await dataSource.getRepository(Wallet).count()).toBe(2);
    expect(await dataSource.getRepository(WalletAsset).count()).toBe(4);
    const tables = await dataSource.query(
      'SELECT tablename FROM pg_tables WHERE schemaname=current_schema() ORDER BY tablename',
    );
    expect(tables.map((table: { tablename: string }) => table.tablename)).toEqual([
      'assets',
      'audit_events',
      'exchanges',
      'idempotency_keys',
      'ledger',
      'quotes',
      'users',
      'wallet_assets',
      'wallets',
    ]);
  });
  it('repeated initialization preserves balances and confirmed history', async () => {
    await initializeSchema(dataSource);
    await seed(dataSource);
    const balances = await dataSource.getRepository(WalletAsset).find({ order: { id: 'ASC' } });
    const history = await dataSource.getRepository(LedgerEntry).find({ order: { id: 'ASC' } });
    await initializeSchema(dataSource);
    await seed(dataSource);
    expect(await dataSource.getRepository(WalletAsset).find({ order: { id: 'ASC' } })).toEqual(
      balances,
    );
    expect(await dataSource.getRepository(LedgerEntry).find({ order: { id: 'ASC' } })).toEqual(
      history,
    );
  });
  it('concurrent seeds fund the wallet exactly once', async () => {
    await initializeSchema(dataSource);
    await Promise.all([seed(dataSource), seed(dataSource)]);
    expect(await dataSource.getRepository(LedgerEntry).count()).toBe(1);
    expect(await dataSource.getRepository(WalletAsset).count()).toBe(4);
    expect(await dataSource.getRepository(Wallet).count()).toBe(2);
    expect(await dataSource.getRepository(Asset).count()).toBe(2);
    expect(
      (
        await dataSource
          .getRepository(WalletAsset)
          .findOneByOrFail({ wallet: { user_id: 'user-001' }, asset: 'USDT-SBX' })
      ).available,
    ).toBe('10000.00000000');
  });
});
