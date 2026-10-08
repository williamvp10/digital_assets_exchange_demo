import {
  Check,
  Column,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  Unique,
} from 'typeorm';
import { Wallet } from './wallet.entity';
import { Asset } from './asset.entity';

/** Mapeo de persistencia; sin lógica de negocio ni conversiones monetarias a Number. */
@Check('wallets_available_check', 'available >= 0')
@Check('wallets_held_check', 'held >= 0')
@Unique('wallet_assets_wallet_asset_key', ['wallet_id', 'asset'])
@Entity('wallet_assets')
export class WalletAsset {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'uuid' })
  wallet_id!: string;

  @Column({ type: 'text' })
  asset!: string;

  @Column({ type: 'numeric', precision: 28, scale: 8, default: '0' })
  available!: string;

  @Column({ type: 'numeric', precision: 28, scale: 8, default: '0' })
  held!: string;

  @Column({
    type: 'numeric',
    precision: 28,
    scale: 8,
    asExpression: 'available + held',
    generatedType: 'STORED',
    insert: false,
    update: false,
  })
  total!: string;

  @ManyToOne(() => Wallet, { nullable: false, onDelete: 'NO ACTION', cascade: false, eager: false })
  @JoinColumn({ name: 'wallet_id', foreignKeyConstraintName: 'wallet_assets_wallet_id_fkey' })
  wallet?: Wallet;

  @ManyToOne(() => Asset, { nullable: false, onDelete: 'NO ACTION', cascade: false, eager: false })
  @JoinColumn({ name: 'asset', foreignKeyConstraintName: 'wallet_assets_asset_fkey' })
  assetInfo?: Asset;
}
