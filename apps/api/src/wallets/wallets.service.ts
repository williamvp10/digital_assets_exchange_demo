import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { WalletAsset } from '../database/entities/wallet-asset.entity';
import { LedgerEntry } from '../database/entities/ledger-entry.entity';

/** Consultas de saldo e historial limitadas al propietario de la wallet. */
@Injectable()
export class WalletsService {
  constructor(
    @InjectRepository(WalletAsset) private readonly wallets: Repository<WalletAsset>,
    @InjectRepository(LedgerEntry) private readonly ledger: Repository<LedgerEntry>,
  ) {}
  async list(userId: string) {
    const balances = await this.wallets.find({
      where: { wallet: { user_id: userId } },
      order: { asset: 'ASC' },
    });
    return balances.map((balance) => ({ ...balance, user_id: userId }));
  }
  async movements(userId: string, walletId: string) {
    // Responder 404 para recursos ajenos evita revelar wallets de otros usuarios.
    if (!(await this.wallets.existsBy({ id: walletId, wallet: { user_id: userId } }))) {
      throw new NotFoundException('Wallet not found');
    }
    return this.ledger.find({
      where: { wallet_asset_id: walletId },
      order: { created_at: 'ASC', id: 'ASC' },
    });
  }
}
