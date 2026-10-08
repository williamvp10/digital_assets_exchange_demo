import {
  Body,
  Controller,
  Get,
  Headers,
  Param,
  ParseUUIDPipe,
  Post,
  Req,
  Res,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiParam,
  ApiHeader,
  ApiCreatedResponse,
  ApiOkResponse,
  ApiBadRequestResponse,
  ApiConflictResponse,
  ApiNotFoundResponse,
  ApiServiceUnavailableResponse,
} from '@nestjs/swagger';
import { Response } from 'express';
import { ApiIdentity } from '../docs/api-identity.decorator';
import { ExchangeResponseDto, ExchangeDetailResponseDto, ApiErrorDto } from '../docs/responses.dto';
import { ActorRequest } from '../auth/auth.middleware';
import { ExchangeDto } from './dto/create-exchange.dto';
import { ExchangesService } from './exchanges.service';

@ApiTags('Intercambios')
@ApiIdentity()
@Controller('exchanges')
export class ExchangesController {
  constructor(private readonly service: ExchangesService) {}
  @Post()
  @ApiOperation({
    summary: 'Crear intercambio (Usuario)',
    description:
      'LOW/MEDIUM completa; HIGH retiene fondos. Repetir clave y contenido devuelve la respuesta original.',
  })
  @ApiHeader({
    name: 'Idempotency-Key',
    required: true,
    description: 'Clave de hasta 200 caracteres, única por usuario.',
    schema: { type: 'string', maxLength: 200 },
    example: 'exchange-001',
  })
  @ApiCreatedResponse({ type: ExchangeResponseDto })
  @ApiBadRequestResponse({
    type: ApiErrorDto,
    description: 'Cotización vencida, saldo insuficiente, body inválido o clave ausente.',
  })
  @ApiConflictResponse({
    type: ApiErrorDto,
    description: 'Cotización consumida o clave usada con otro contenido.',
  })
  @ApiNotFoundResponse({ type: ApiErrorDto, description: 'Cotización inexistente o ajena.' })
  @ApiServiceUnavailableResponse({
    type: ExchangeResponseDto,
    description: 'Monitoreo indisponible: operación FAILED sin modificar saldos.',
  })
  async create(
    @Req() req: ActorRequest,
    @Body() dto: ExchangeDto,
    @Headers('idempotency-key') key: string,
    @Res() res: Response,
  ) {
    const result = await this.service.create(req.actor.id, dto.quoteId, key);
    res.status(result.status).json(result.body);
  }
  @Get()
  @ApiOperation({ summary: 'Consultar operaciones propias (Usuario)' })
  @ApiOkResponse({ type: [ExchangeResponseDto] })
  list(@Req() req: ActorRequest) {
    return this.service.list(req.actor.id);
  }
  @Get(':id')
  @ApiOperation({ summary: 'Consultar operación y trazabilidad' })
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiOkResponse({ type: ExchangeDetailResponseDto })
  @ApiNotFoundResponse({ type: ApiErrorDto, description: 'Operación inexistente o ajena.' })
  @ApiBadRequestResponse({ type: ApiErrorDto, description: 'UUID inválido.' })
  detail(@Req() req: ActorRequest, @Param('id', new ParseUUIDPipe()) id: string) {
    return this.service.detail(req.actor.id, id);
  }
}
