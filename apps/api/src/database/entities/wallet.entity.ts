import { Column, Entity, JoinColumn, ManyToOne, PrimaryGeneratedColumn, Unique } from 'typeorm';
import { User } from './user.entity';

/** Contenedor del usuario; los saldos por activo viven en WalletAsset. */
@Entity('wallets')
@Unique('wallets_user_id_key', ['user_id'])
export class Wallet {
  @PrimaryGeneratedColumn('uuid')
  id!: string;
  @Column({ type: 'text' })
  user_id!: string;
  @ManyToOne(() => User, { nullable: false, cascade: false, onDelete: 'NO ACTION' })
  @JoinColumn({ name: 'user_id', foreignKeyConstraintName: 'wallets_user_id_fkey' })
  user?: User;
}
