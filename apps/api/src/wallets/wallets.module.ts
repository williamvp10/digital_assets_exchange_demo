import { TypeOrmModule } from '@nestjs/typeorm';
import { WalletAsset } from '../database/entities/wallet-asset.entity';
import { LedgerEntry } from '../database/entities/ledger-entry.entity';
import { Module } from '@nestjs/common';
import { WalletsController } from './wallets.controller';
import { WalletsService } from './wallets.service';

@Module({
  imports: [TypeOrmModule.forFeature([WalletAsset, LedgerEntry])],
  controllers: [WalletsController],
  providers: [WalletsService],
})
export class WalletsModule {}
