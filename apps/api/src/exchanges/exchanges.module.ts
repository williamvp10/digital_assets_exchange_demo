import { TypeOrmModule } from '@nestjs/typeorm';
import { Quote } from '../database/entities/quote.entity';
import { Exchange } from '../database/entities/exchange.entity';
import { IdempotencyKey } from '../database/entities/idempotency-key.entity';
import { AuditEvent } from '../database/entities/audit-event.entity';
import { Module } from '@nestjs/common';
import { ExchangesController } from './exchanges.controller';
import { ComplianceController } from '../compliance/compliance.controller';
import { ExchangesService } from './exchanges.service';
import { Monitor } from '../compliance/monitor.service';
import { Ledger } from '../ledger/ledger.service';

@Module({
  imports: [TypeOrmModule.forFeature([Quote, Exchange, IdempotencyKey, AuditEvent])],
  controllers: [ExchangesController, ComplianceController],
  providers: [ExchangesService, Monitor, Ledger],
})
export class ExchangesModule {}
