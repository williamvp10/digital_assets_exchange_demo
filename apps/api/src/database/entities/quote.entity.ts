import { Check, Column, Entity, JoinColumn, ManyToOne, PrimaryGeneratedColumn } from 'typeorm';
import { Asset } from './asset.entity';
import { User } from './user.entity';

/** Mapeo de persistencia; sin lógica de negocio ni conversiones monetarias a Number. */
@Check('quotes_amount_check', 'amount > 0')
@Check('quotes_received_check', 'received > 0')
@Check('quotes_status_check', "status IN ('ACTIVE','EXPIRED','USED')")
@Entity('quotes')
export class Quote {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'text' })
  user_id!: string;

  @Column({ type: 'text', default: 'USDT-SBX' })
  source_asset!: string;

  @Column({ type: 'text', default: 'XAUT-SBX' })
  target_asset!: string;

  @Column({ type: 'numeric', precision: 28, scale: 8 })
  amount!: string;

  @Column({ type: 'numeric', precision: 28, scale: 8 })
  price!: string;

  @Column({ type: 'numeric', precision: 28, scale: 8 })
  fee!: string;

  @Column({ type: 'numeric', precision: 28, scale: 8 })
  received!: string;

  @Column({ type: 'timestamptz', default: () => 'clock_timestamp()' })
  created_at!: Date;

  @Column({ type: 'timestamptz' })
  expires_at!: Date;

  @Column({ type: 'text', default: 'ACTIVE' })
  status!: 'ACTIVE' | 'EXPIRED' | 'USED';

  @ManyToOne(() => Asset, { nullable: false, cascade: false, onDelete: 'NO ACTION' })
  @JoinColumn({ name: 'source_asset', foreignKeyConstraintName: 'quotes_source_asset_fkey' })
  sourceAsset?: Asset;

  @ManyToOne(() => Asset, { nullable: false, cascade: false, onDelete: 'NO ACTION' })
  @JoinColumn({ name: 'target_asset', foreignKeyConstraintName: 'quotes_target_asset_fkey' })
  targetAsset?: Asset;

  @ManyToOne(() => User, { nullable: false, onDelete: 'NO ACTION', cascade: false, eager: false })
  @JoinColumn({ name: 'user_id', foreignKeyConstraintName: 'quotes_user_id_fkey' })
  user?: User;
}
