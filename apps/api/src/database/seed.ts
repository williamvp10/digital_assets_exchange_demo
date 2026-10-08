import 'reflect-metadata';
import './env';
import { DataSource } from 'typeorm';
import { databaseOptions } from './database.config';
import { User } from './entities/user.entity';
import { Wallet } from './entities/wallet.entity';
import { WalletAsset } from './entities/wallet-asset.entity';
import { Asset } from './entities/asset.entity';
import { LedgerEntry } from './entities/ledger-entry.entity';

/** Crea wallets vacías y financia solo las nuevas; repetir o ejecutar simultáneamente no duplica fondos. */
export async function seed(dataSource: DataSource) {
  await dataSource.transaction(async (manager) => {
    // SQL específico de PostgreSQL: el ORM no tiene una abstracción para advisory locks.
    await manager.query("SELECT pg_advisory_xact_lock(hashtextextended('assets:seed',0))");
    await manager
      .getRepository(User)
      .createQueryBuilder()
      .insert()
      .values([
        { id: 'user-001', role: 'USER' },
        { id: 'compliance-001', role: 'COMPLIANCE' },
      ])
      .orIgnore()
      .execute();
    await manager
      .getRepository(Asset)
      .createQueryBuilder()
      .insert()
      .values([
        { code: 'USDT-SBX', name: 'Sandbox USDT' },
        { code: 'XAUT-SBX', name: 'Sandbox tokenized gold' },
      ])
      .orIgnore()
      .execute();
    for (const userId of ['user-001', 'compliance-001']) {
      const containers = manager.getRepository(Wallet);
      const container =
        (await containers.findOneBy({ user_id: userId })) ??
        (await containers.save(containers.create({ user_id: userId })));
      for (const asset of ['USDT-SBX', 'XAUT-SBX'] as const) {
        const wallets = manager.getRepository(WalletAsset);
        if (await wallets.existsBy({ wallet_id: container.id, asset })) continue;
        const wallet = await wallets.save(wallets.create({ wallet_id: container.id, asset }));
        if (userId === 'user-001' && asset === 'USDT-SBX') {
          // El trigger del ledger aplica el saldo inicial; no editar la wallet mediante save/update.
          await manager.getRepository(LedgerEntry).insert({
            wallet_asset_id: wallet.id,
            exchange_id: null,
            reference: 'initial-funding',
            type: 'SEED',
            available_delta: '10000.00000000',
            held_delta: '0.00000000',
            available_before: '0.00000000',
            available_after: '10000.00000000',
            held_before: '0.00000000',
            held_after: '0.00000000',
          });
        }
      }
    }
  });
}
if (require.main === module) {
  const dataSource = new DataSource(databaseOptions(process.env.DATABASE_URL));
  dataSource
    .initialize()
    .then(() => seed(dataSource))
    .then(() => console.log('Seed ready (safe to repeat)'))
    .catch((error) => {
      console.error(error);
      process.exitCode = 1;
    })
    .finally(async () => {
      if (dataSource.isInitialized) await dataSource.destroy();
    });
}
