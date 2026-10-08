import { Controller, Get, Param, ParseUUIDPipe, Patch, Req } from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiParam,
  ApiOkResponse,
  ApiBadRequestResponse,
  ApiConflictResponse,
  ApiNotFoundResponse,
} from '@nestjs/swagger';
import { ApiIdentity } from '../docs/api-identity.decorator';
import {
  ExchangeResponseDto,
  ExchangeDetailResponseDto,
  PendingExchangeResponseDto,
  ApiErrorDto,
} from '../docs/responses.dto';
import { ActorRequest } from '../auth/auth.middleware';
import { ExchangesService } from '../exchanges/exchanges.service';

@ApiTags('Cumplimiento')
@ApiIdentity()
@ApiBadRequestResponse({ type: ApiErrorDto, description: 'UUID inválido.' })
@ApiNotFoundResponse({ type: ApiErrorDto, description: 'Operación inexistente.' })
@Controller('compliance/exchanges')
export class ComplianceController {
  constructor(private readonly service: ExchangesService) {}
  @Get('pending')
  @ApiOperation({ summary: 'Listar operaciones retenidas (Cumplimiento)' })
  @ApiOkResponse({ type: [PendingExchangeResponseDto] })
  pending() {
    return this.service.pending();
  }
  @Get(':id')
  @ApiOperation({ summary: 'Consultar operación y trazabilidad' })
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiOkResponse({ type: ExchangeDetailResponseDto })
  @ApiNotFoundResponse({ type: ApiErrorDto, description: 'Operación inexistente o ajena.' })
  @ApiBadRequestResponse({ type: ApiErrorDto, description: 'UUID inválido.' })
  detail(@Param('id', new ParseUUIDPipe()) id: string) {
    return this.service.complianceDetail(id);
  }
  @Patch(':id/approve')
  @ApiOperation({
    summary:
      'Aprobar: consumir el saldo retenido y acreditar XAUT al precio original. (Cumplimiento)',
  })
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiOkResponse({ type: ExchangeResponseDto })
  @ApiConflictResponse({
    type: ApiErrorDto,
    description: 'La operación ya fue decidida o no está pendiente.',
  })
  approve(@Req() req: ActorRequest, @Param('id', new ParseUUIDPipe()) id: string) {
    return this.service.decide(req.actor.id, id, true);
  }
  @Patch(':id/reject')
  @ApiOperation({ summary: 'Rechazar: liberar USDT retenido sin acreditar XAUT. (Cumplimiento)' })
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiOkResponse({ type: ExchangeResponseDto })
  @ApiConflictResponse({
    type: ApiErrorDto,
    description: 'La operación ya fue decidida o no está pendiente.',
  })
  reject(@Req() req: ActorRequest, @Param('id', new ParseUUIDPipe()) id: string) {
    return this.service.decide(req.actor.id, id, false);
  }
}
