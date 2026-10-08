import { ApiProperty } from '@nestjs/swagger';
import { IsUUID } from 'class-validator';

/** La ejecución solo recibe una referencia: los montos salen de la cotización guardada. */
export class ExchangeDto {
  @ApiProperty({
    format: 'uuid',
    example: '9a1864cd-3d4d-454f-b70a-46f9b0d77e14',
    description: 'Cotización propia, activa y no consumida.',
  })
  @IsUUID()
  quoteId!: string;
}
