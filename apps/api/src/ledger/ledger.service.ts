import { Injectable, InternalServerErrorException } from '@nestjs/common';
import { EntityManager } from 'typeorm';
import Decimal from 'decimal.js';
import { WalletAsset } from '../database/entities/wallet-asset.entity';
import { LedgerEntry } from '../database/entities/ledger-entry.entity';

type LedgerMovementType = 'DEBIT' | 'CREDIT' | 'HOLD' | 'RELEASE';

/** Único punto de escritura monetaria. El trigger del ledger aplica el saldo, nunca walletAsset.save(). */
@Injectable()
export class Ledger {
  /** Recibe el manager de la transacción para que movimientos y saldos se reviertan juntos. */
  async move(
    manager: EntityManager,
    walletAssetId: string,
    exchangeId: string,
    type: LedgerMovementType,
    availableDelta: string,
    heldDelta = '0',
  ) {
    if (!manager.queryRunner?.isTransactionActive) {
      throw new InternalServerErrorException('Ledger requires an active transaction');
    }
    // El objeto wallet previo puede estar desactualizado después de un trigger: consultar otra vez.
    const wallet = await manager.getRepository(WalletAsset).findOne({
      where: { id: walletAssetId },
      lock: { mode: 'pessimistic_write' },
    });
    if (!wallet) throw new InternalServerErrorException('Wallet not initialized');
    await manager.getRepository(LedgerEntry).insert({
      wallet_asset_id: walletAssetId,
      exchange_id: exchangeId,
      reference: exchangeId,
      type,
      available_delta: availableDelta,
      held_delta: heldDelta,
      available_before: wallet.available,
      available_after: new Decimal(wallet.available).plus(availableDelta).toFixed(8),
      held_before: wallet.held,
      held_after: new Decimal(wallet.held).plus(heldDelta).toFixed(8),
    });
  }
}
