import {
  Check,
  Column,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { Quote } from './quote.entity';
import { User } from './user.entity';

/** Mapeo de persistencia; sin lógica de negocio ni conversiones monetarias a Number. */
@Check(
  'exchanges_status_check',
  "status IN ('CREATED','PROCESSING','PENDING_REVIEW','COMPLETED','REJECTED','FAILED')",
)
@Check('exchanges_risk_check', "risk IN ('LOW','MEDIUM','HIGH')")
@Index('consumed_quote', ['quote_id'], { unique: true, where: "status <> 'FAILED'" })
@Index('exchange_owner', ['user_id', 'created_at'])
@Index('pending_exchanges', ['status'], { where: "status='PENDING_REVIEW'" })
@Entity('exchanges')
export class Exchange {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'text' })
  user_id!: string;

  @Column({ type: 'uuid' })
  quote_id!: string;

  @Column({ type: 'text' })
  status!: 'CREATED' | 'PROCESSING' | 'PENDING_REVIEW' | 'COMPLETED' | 'REJECTED' | 'FAILED';

  @Column({ type: 'text', nullable: true })
  risk!: 'LOW' | 'MEDIUM' | 'HIGH' | null;

  @Column({ type: 'boolean', default: false })
  requires_follow_up!: boolean;

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

  @ManyToOne(() => User, { nullable: false, onDelete: 'NO ACTION', cascade: false, eager: false })
  @JoinColumn({ name: 'user_id', foreignKeyConstraintName: 'exchanges_user_id_fkey' })
  user?: User;

  @ManyToOne(() => Quote, { nullable: false, onDelete: 'NO ACTION', cascade: false, eager: false })
  @JoinColumn({ name: 'quote_id', foreignKeyConstraintName: 'exchanges_quote_id_fkey' })
  quote?: Quote;
}
