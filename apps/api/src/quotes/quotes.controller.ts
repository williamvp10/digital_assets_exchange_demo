import { Body, Controller, Post, Req } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiCreatedResponse, ApiBadRequestResponse } from '@nestjs/swagger';
import { ApiIdentity } from '../docs/api-identity.decorator';
import { QuoteResponseDto, ApiErrorDto } from '../docs/responses.dto';
import { ActorRequest } from '../auth/auth.middleware';
import { QuoteDto } from './dto/create-quote.dto';
import { QuotesService } from './quotes.service';

@ApiTags('Cotizaciones')
@ApiIdentity()
@Controller('quotes')
export class QuotesController {
  constructor(private readonly service: QuotesService) {}
  @Post()
  @ApiOperation({
    summary: 'Solicitar cotización (Usuario)',
    description:
      'Precio 2500, comisión 1 %, vigencia 30 segundos. XAUT recibido redondeado hacia abajo.',
  })
  @ApiCreatedResponse({ type: QuoteResponseDto })
  @ApiBadRequestResponse({ type: ApiErrorDto, description: 'Monto inválido o demasiado pequeño.' })
  create(@Req() req: ActorRequest, @Body() dto: QuoteDto) {
    return this.service.create(req.actor.id, dto.amount);
  }
}
