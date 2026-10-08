import { Column, Entity, JoinColumn, ManyToOne, PrimaryGeneratedColumn } from 'typeorm';
import { Exchange } from './exchange.entity';
import { User } from './user.entity';

/** Mapeo de persistencia; sin lógica de negocio ni conversiones monetarias a Number. */
@Entity('audit_events')
export class AuditEvent {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'uuid' })
  exchange_id!: string;

  @Column({ type: 'text' })
  actor_id!: string;

  @Column({ type: 'text' })
  event!: string;

  @Column({ type: 'jsonb', default: () => "'{}'::jsonb" })
  details!: Record<string, unknown>;

  @Column({ type: 'timestamptz', default: () => 'clock_timestamp()' })
  created_at!: Date;

  @ManyToOne(() => Exchange, {
    nullable: false,
    onDelete: 'NO ACTION',
    cascade: false,
    eager: false,
  })
  @JoinColumn({ name: 'exchange_id', foreignKeyConstraintName: 'audit_events_exchange_id_fkey' })
  exchange?: Exchange;

  @ManyToOne(() => User, { nullable: false, onDelete: 'NO ACTION', cascade: false, eager: false })
  @JoinColumn({ name: 'actor_id', foreignKeyConstraintName: 'audit_events_actor_id_fkey' })
  actor?: User;
}
