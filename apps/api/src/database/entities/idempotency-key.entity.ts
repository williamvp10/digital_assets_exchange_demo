import { Column, Entity, JoinColumn, ManyToOne, PrimaryColumn } from 'typeorm';
import { Exchange } from './exchange.entity';
import { User } from './user.entity';

/** Mapeo de persistencia; sin lógica de negocio ni conversiones monetarias a Number. */
@Entity('idempotency_keys')
export class IdempotencyKey {
  @PrimaryColumn({ type: 'text' })
  user_id!: string;

  @PrimaryColumn({ type: 'text' })
  key!: string;

  @Column({ type: 'text' })
  request_hash!: string;

  @Column({ type: 'uuid' })
  exchange_id!: string;

  @Column({ type: 'integer' })
  response_status!: number;

  @Column({ type: 'jsonb' })
  response_body!: Record<string, unknown>;

  @ManyToOne(() => User, { nullable: false, onDelete: 'NO ACTION', cascade: false, eager: false })
  @JoinColumn({ name: 'user_id', foreignKeyConstraintName: 'idempotency_keys_user_id_fkey' })
  user?: User;

  @ManyToOne(() => Exchange, {
    nullable: false,
    onDelete: 'NO ACTION',
    cascade: false,
    eager: false,
  })
  @JoinColumn({
    name: 'exchange_id',
    foreignKeyConstraintName: 'idempotency_keys_exchange_id_fkey',
  })
  exchange?: Exchange;
}
