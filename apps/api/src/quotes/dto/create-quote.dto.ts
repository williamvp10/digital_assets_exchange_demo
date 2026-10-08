import { ApiProperty } from '@nestjs/swagger';
import { IsString, Matches } from 'class-validator';

/** Entrada monetaria como texto para evitar pérdidas de precisión JSON/JavaScript. */
export class QuoteDto {
  @ApiProperty({
    example: '2500',
    description: 'Monto origen en USDT-SBX. Cadena positiva de hasta 20 enteros y 8 decimales.',
    pattern: /^\d{1,20}(\.\d{1,8})?$/.source,
  })
  @IsString()
  @Matches(/^\d{1,20}(\.\d{1,8})?$/)
  amount!: string;
}
