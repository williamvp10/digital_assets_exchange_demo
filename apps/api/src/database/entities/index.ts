import { Asset } from './asset.entity';
import { WalletAsset } from './wallet-asset.entity';
import { User } from './user.entity';
import { Wallet } from './wallet.entity';
import { Quote } from './quote.entity';
import { Exchange } from './exchange.entity';
import { IdempotencyKey } from './idempotency-key.entity';
import { LedgerEntry } from './ledger-entry.entity';
import { AuditEvent } from './audit-event.entity';

export const ENTITIES = [
  Asset,
  WalletAsset,
  User,
  Wallet,
  Quote,
  Exchange,
  IdempotencyKey,
  LedgerEntry,
  AuditEvent,
];
