import { Controller, Get, Param, ParseUUIDPipe, Req } from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiOkResponse,
  ApiParam,
  ApiNotFoundResponse,
  ApiBadRequestResponse,
} from '@nestjs/swagger';
import { ApiIdentity } from '../docs/api-identity.decorator';
import { WalletResponseDto, MovementResponseDto, ApiErrorDto } from '../docs/responses.dto';
import { ActorRequest } from '../auth/auth.middleware';
import { WalletsService } from './wallets.service';

@ApiTags('Wallets')
@ApiIdentity()
@Controller('wallets')
export class WalletsController {
  constructor(private readonly service: WalletsService) {}
  @Get()
  @ApiOperation({ summary: 'Consultar wallets propias (Usuario)' })
  @ApiOkResponse({ type: [WalletResponseDto] })
  list(@Req() req: ActorRequest) {
    return this.service.list(req.actor.id);
  }
  @Get(':id/movements')
  @ApiOperation({ summary: 'Consultar movimientos confirmados de una wallet propia (Usuario)' })
  @ApiParam({
    name: 'id',
    format: 'uuid',
    description: 'Identificador del saldo wallet_assets (id de GET /wallets).',
  })
  @ApiOkResponse({ type: [MovementResponseDto] })
  @ApiNotFoundResponse({ type: ApiErrorDto, description: 'Wallet inexistente o de otro usuario.' })
  @ApiBadRequestResponse({ type: ApiErrorDto, description: 'UUID inválido.' })
  movements(@Req() req: ActorRequest, @Param('id', new ParseUUIDPipe()) id: string) {
    return this.service.movements(req.actor.id, id);
  }
}
