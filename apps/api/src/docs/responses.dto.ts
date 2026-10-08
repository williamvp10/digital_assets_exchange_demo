import { ApiProperty } from '@nestjs/swagger';

// Estos DTOs documentan respuestas; la validación de entrada vive en los DTOs de cada módulo.

export class ApiErrorDto {
  @ApiProperty({ example: 400 })
  statusCode!: number;
  @ApiProperty({
    oneOf: [{ type: 'string' }, { type: 'array', items: { type: 'string' } }],
    example: 'Saldo insuficiente',
  })
  message!: string | string[];
  @ApiProperty({ example: 'Bad Request' })
  error!: string;
}

export class WalletResponseDto {
  @ApiProperty({ format: 'uuid', description: 'Contenedor wallet del usuario.' })
  wallet_id!: string;
  @ApiProperty({ example: '0b6c02aa-239b-4f19-91c7-4c0c536edb12', format: 'uuid' })
  id!: string;
  @ApiProperty({ example: 'user-001' })
  user_id!: string;
  @ApiProperty({ example: 'USDT-SBX' })
  asset!: string;
  @ApiProperty({ example: '10000.00000000' })
  available!: string;
  @ApiProperty({ example: '0.00000000' })
  held!: string;
  @ApiProperty({ example: '10000.00000000' })
  total!: string;
}

export class QuoteResponseDto {
  @ApiProperty({ example: '0b6c02aa-239b-4f19-91c7-4c0c536edb12', format: 'uuid' })
  id!: string;
  @ApiProperty({ example: 'user-001' })
  user_id!: string;
  @ApiProperty({ example: 'USDT-SBX' })
  source_asset!: string;
  @ApiProperty({ example: 'XAUT-SBX' })
  target_asset!: string;
  @ApiProperty({ example: '2500.00000000' })
  amount!: string;
  @ApiProperty({ example: '2500.00000000' })
  price!: string;
  @ApiProperty({ example: '25.00000000' })
  fee!: string;
  @ApiProperty({ example: '0.99000000' })
  received!: string;
  @ApiProperty({ example: '2026-10-08T12:00:00.000Z', format: 'date-time' })
  created_at!: string;
  @ApiProperty({ example: '2026-10-08T12:00:30.000Z', format: 'date-time' })
  expires_at!: string;
  @ApiProperty({ example: 'ACTIVE' })
  status!: string;
}

export class ExchangeResponseDto {
  @ApiProperty({ example: '0b6c02aa-239b-4f19-91c7-4c0c536edb12', format: 'uuid' })
  id!: string;
  @ApiProperty({ example: 'user-001' })
  user_id!: string;
  @ApiProperty({ example: '9a1864cd-3d4d-454f-b70a-46f9b0d77e14', format: 'uuid' })
  quote_id!: string;
  @ApiProperty({ example: 'COMPLETED' })
  status!: string;
  @ApiProperty({ example: false })
  requires_follow_up!: boolean;
  @ApiProperty({ example: '2500.00000000' })
  amount!: string;
  @ApiProperty({ example: '2500.00000000' })
  price!: string;
  @ApiProperty({ example: '25.00000000' })
  fee!: string;
  @ApiProperty({ example: '0.99000000' })
  received!: string;
  @ApiProperty({ example: '2026-10-08T12:00:00.000Z', format: 'date-time' })
  created_at!: string;
  @ApiProperty({ enum: ['LOW', 'MEDIUM', 'HIGH'], nullable: true, example: 'MEDIUM' })
  risk!: 'LOW' | 'MEDIUM' | 'HIGH' | null;
}

export class AuditEventResponseDto {
  @ApiProperty({ example: '0b6c02aa-239b-4f19-91c7-4c0c536edb12', format: 'uuid' })
  id!: string;
  @ApiProperty({ example: '9a1864cd-3d4d-454f-b70a-46f9b0d77e14', format: 'uuid' })
  exchange_id!: string;
  @ApiProperty({ example: 'compliance-001' })
  actor_id!: string;
  @ApiProperty({ example: 'COMPLETED' })
  event!: string;
  @ApiProperty({ example: '2026-10-08T12:00:00.000Z', format: 'date-time' })
  created_at!: string;
  @ApiProperty({ type: 'object', additionalProperties: true, example: {} })
  details!: Record<string, unknown>;
}

export class MovementResponseDto {
  @ApiProperty({ example: '0b6c02aa-239b-4f19-91c7-4c0c536edb12', format: 'uuid' })
  id!: string;
  @ApiProperty({ example: '9a1864cd-3d4d-454f-b70a-46f9b0d77e14', format: 'uuid' })
  wallet_asset_id!: string;
  @ApiProperty({ example: 'initial-funding' })
  reference!: string;
  @ApiProperty({ example: 'SEED' })
  type!: string;
  @ApiProperty({ example: '10000.00000000' })
  available_delta!: string;
  @ApiProperty({ example: '0.00000000' })
  held_delta!: string;
  @ApiProperty({ example: '0.00000000' })
  available_before!: string;
  @ApiProperty({ example: '10000.00000000' })
  available_after!: string;
  @ApiProperty({ example: '0.00000000' })
  held_before!: string;
  @ApiProperty({ example: '0.00000000' })
  held_after!: string;
  @ApiProperty({ example: 'CONFIRMED' })
  status!: string;
  @ApiProperty({ example: '2026-10-08T12:00:00.000Z', format: 'date-time' })
  created_at!: string;
  @ApiProperty({ type: String, format: 'uuid', nullable: true, example: null })
  exchange_id!: string | null;
}

export class ExchangeDetailResponseDto extends ExchangeResponseDto {
  @ApiProperty({ type: [AuditEventResponseDto] })
  events!: AuditEventResponseDto[];
}

export class PendingExchangeResponseDto extends ExchangeResponseDto {
  @ApiProperty({ type: [AuditEventResponseDto], nullable: true })
  events!: AuditEventResponseDto[] | null;
}
