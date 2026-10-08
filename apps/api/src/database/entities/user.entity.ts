import { Check, Column, Entity, PrimaryColumn } from 'typeorm';

/** Mapeo de persistencia; sin lógica de negocio ni conversiones monetarias a Number. */
@Check('users_role_check', "role IN ('USER','COMPLIANCE')")
@Entity('users')
export class User {
  @PrimaryColumn({ type: 'text' })
  id!: string;

  @Column({ type: 'text' })
  role!: 'USER' | 'COMPLIANCE';
}
