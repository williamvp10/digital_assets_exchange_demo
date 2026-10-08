import { Column, Entity, PrimaryColumn } from 'typeorm';

/** Catálogo compartido: el código es la identidad estable del activo. */
@Entity('assets')
export class Asset {
  @PrimaryColumn({ type: 'text' })
  code!: string;
  @Column({ type: 'text' })
  name!: string;
}
