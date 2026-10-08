import {
  Check,
  Column,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { Exchange } from './exchange.entity';
import { WalletAsset } from './wallet-asset.entity';

/** Mapeo de persistencia; sin lógica de negocio ni conversiones monetarias a Number. */
@Check('ledger_type_check', "type IN ('DEBIT','CREDIT','HOLD','RELEASE','SEED')")
@Check('ledger_status_check', "status = 'CONFIRMED'")
@Check('ledger_available_after_check', 'available_after >= 0')
@Check('ledger_held_after_check', 'held_after >= 0')
@Check('ledger_check', 'available_after = available_before + available_delta')
@Check('ledger_check1', 'held_after = held_before + held_delta')
@Index('ledger_wallet', ['wallet_asset_id', 'created_at'])
@Entity('ledger')
export class LedgerEntry {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'uuid' })
  wallet_asset_id!: string;

  @Column({ type: 'uuid', nullable: true })
  exchange_id!: string | null;

  @Column({ type: 'text' })
  reference!: string;

  @Column({ type: 'text' })
  type!: 'DEBIT' | 'CREDIT' | 'HOLD' | 'RELEASE' | 'SEED';

  @Column({ type: 'numeric', precision: 28, scale: 8 })
  available_delta!: string;

  @Column({ type: 'numeric', precision: 28, scale: 8 })
  held_delta!: string;

  @Column({ type: 'numeric', precision: 28, scale: 8 })
  available_before!: string;

  @Column({ type: 'numeric', precision: 28, scale: 8 })
  available_after!: string;

  @Column({ type: 'numeric', precision: 28, scale: 8 })
  held_before!: string;

  @Column({ type: 'numeric', precision: 28, scale: 8 })
  held_after!: string;

  @Column({ type: 'text', default: 'CONFIRMED' })
  status!: 'CONFIRMED';

  @Column({ type: 'timestamptz', default: () => 'clock_timestamp()' })
  created_at!: Date;

  @ManyToOne(() => WalletAsset, {
    nullable: false,
    onDelete: 'NO ACTION',
    cascade: false,
    eager: false,
  })
  @JoinColumn({ name: 'wallet_asset_id', foreignKeyConstraintName: 'ledger_wallet_asset_id_fkey' })
  walletAsset?: WalletAsset;

  @ManyToOne(() => Exchange, {
    nullable: true,
    onDelete: 'NO ACTION',
    cascade: false,
    eager: false,
  })
  @JoinColumn({ name: 'exchange_id', foreignKeyConstraintName: 'ledger_exchange_id_fkey' })
  exchange?: Exchange | null;
}
