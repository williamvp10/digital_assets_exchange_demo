import {
  Injectable,
  BadRequestException,
  ConflictException,
  NotFoundException,
  InternalServerErrorException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, EntityManager, In, Repository } from 'typeorm';
import { createHash } from 'node:crypto';
import Decimal from 'decimal.js';
import { WalletAsset } from '../database/entities/wallet-asset.entity';
import { Quote } from '../database/entities/quote.entity';
import { Exchange } from '../database/entities/exchange.entity';
import { IdempotencyKey } from '../database/entities/idempotency-key.entity';
import { AuditEvent } from '../database/entities/audit-event.entity';
import { Monitor, Risk } from '../compliance/monitor.service';
import { Ledger } from '../ledger/ledger.service';

/** Orquesta el intercambio; cada efecto monetario usa el manager de una única transacción. */
@Injectable()
export class ExchangesService {
  constructor(
    private readonly dataSource: DataSource,
    @InjectRepository(Quote) private readonly quotes: Repository<Quote>,
    @InjectRepository(Exchange) private readonly exchanges: Repository<Exchange>,
    @InjectRepository(IdempotencyKey) private readonly idempotency: Repository<IdempotencyKey>,
    @InjectRepository(AuditEvent) private readonly auditEvents: Repository<AuditEvent>,
    private readonly monitor: Monitor,
    private readonly ledger: Ledger,
  ) {}

  /** La respuesta de creación permanece estable aunque Cumplimiento haya decidido después. */
  private replay(record: IdempotencyKey, requestHash: string) {
    if (record.request_hash !== requestHash)
      throw new ConflictException('Idempotency key reused with different content');
    return { status: record.response_status, body: record.response_body };
  }

  /** Consulta la red antes de bloquear; vuelve a validar el estado y el saldo bajo bloqueo. */
  async create(userId: string, quoteId: string, idempotencyKey: string) {
    if (!idempotencyKey || idempotencyKey.length > 200)
      throw new BadRequestException('Idempotency-Key required (max 200 characters)');
    const requestHash = createHash('sha256').update(JSON.stringify({ quoteId })).digest('hex');
    const existing = await this.idempotency.findOneBy({ user_id: userId, key: idempotencyKey });
    if (existing) return this.replay(existing, requestHash);
    const quote = await this.quotes.findOneBy({ id: quoteId, user_id: userId });
    if (!quote) throw new NotFoundException('Quote not found');
    if (quote.status !== 'ACTIVE') throw new ConflictException('Quote already consumed or expired');
    if (quote.expires_at.getTime() <= Date.now()) throw new BadRequestException('Quote expired');
    let risk: Risk | undefined;
    try {
      risk = await this.monitor.screen(quote.amount);
    } catch {
      /* Riesgo desconocido nunca permite mover fondos: se registra FAILED y HTTP 503. */
    }

    return this.dataSource.transaction(async (manager) => {
      // PostgreSQL libera el advisory lock en COMMIT/ROLLBACK. La PK respalda la unicidad persistente.
      await manager.query('SELECT pg_advisory_xact_lock(hashtextextended($1,0))', [
        JSON.stringify([userId, idempotencyKey]),
      ]);
      const keys = manager.getRepository(IdempotencyKey);
      const repeat = await keys.findOneBy({ user_id: userId, key: idempotencyKey });
      if (repeat) return this.replay(repeat, requestHash);
      const quoteRepository = manager.getRepository(Quote);
      const lockedQuote = await quoteRepository.findOne({
        where: { id: quoteId, user_id: userId },
        lock: { mode: 'pessimistic_write' },
      });
      if (!lockedQuote) throw new NotFoundException('Quote not found');
      if (lockedQuote.status !== 'ACTIVE') throw new ConflictException('Quote already consumed');
      // Consultar el reloj DB después de adquirir el bloqueo, incluso si hubo espera.
      const expiration: { expired: boolean }[] = await manager.query(
        'SELECT $1::timestamptz <= clock_timestamp() AS expired',
        [lockedQuote.expires_at],
      );
      if (expiration[0].expired) throw new BadRequestException('Quote expired');
      const { source, target } = await this.lockUserWallets(
        manager,
        userId,
        lockedQuote.source_asset,
        lockedQuote.target_asset,
      );
      // Esta validación dentro del bloqueo evita que dos solicitudes gasten el mismo saldo.
      if (new Decimal(source.available).lt(lockedQuote.amount))
        throw new BadRequestException('Insufficient funds');
      const status: Exchange['status'] = !risk
        ? 'FAILED'
        : risk === 'HIGH'
          ? 'PENDING_REVIEW'
          : 'COMPLETED';
      const operations = manager.getRepository(Exchange);
      const saved = await operations.save(
        operations.create({
          user_id: userId,
          quote_id: quoteId,
          status,
          risk: risk ?? null,
          requires_follow_up: risk === 'MEDIUM',
          amount: lockedQuote.amount,
          price: lockedQuote.price,
          fee: lockedQuote.fee,
          received: lockedQuote.received,
        }),
      );
      // Recargar garantiza una respuesta completa con todos los valores de PostgreSQL y sin relaciones.
      const exchange = await operations.findOneByOrFail({ id: saved.id });
      if (risk === 'HIGH') {
        await this.ledger.move(
          manager,
          source.id,
          exchange.id,
          'HOLD',
          new Decimal(lockedQuote.amount).negated().toFixed(8),
          lockedQuote.amount,
        );
      } else if (risk) {
        await this.ledger.move(
          manager,
          source.id,
          exchange.id,
          'DEBIT',
          new Decimal(lockedQuote.amount).negated().toFixed(8),
        );
        await this.ledger.move(manager, target.id, exchange.id, 'CREDIT', lockedQuote.received);
      }
      if (risk) await quoteRepository.update({ id: quoteId }, { status: 'USED' });
      await this.audit(
        manager,
        exchange.id,
        userId,
        status,
        !risk ? { reason: 'MONITOR_UNAVAILABLE' } : {},
      );
      const responseStatus = risk ? 201 : 503;
      // Convertir fechas a JSON igual que la respuesta HTTP; nunca guardar una entidad con relaciones.
      const responseBody: Record<string, unknown> = JSON.parse(JSON.stringify(exchange));
      await keys.save(
        keys.create({
          user_id: userId,
          key: idempotencyKey,
          request_hash: requestHash,
          exchange_id: exchange.id,
          response_status: responseStatus,
          response_body: responseBody,
        }),
      );
      return { status: responseStatus, body: exchange };
    });
  }

  /** Filtrar por propietario evita revelar operaciones ajenas. */
  async detail(userId: string, id: string) {
    const exchange = await this.exchanges.findOneBy({ id, user_id: userId });
    if (!exchange) throw new NotFoundException('Exchange not found');
    return { ...exchange, events: await this.eventsFor(id) };
  }
  async complianceDetail(id: string) {
    const exchange = await this.exchanges.findOneBy({ id });
    if (!exchange) throw new NotFoundException('Exchange not found');
    return { ...exchange, events: await this.eventsFor(id) };
  }
  list(userId: string) {
    return this.exchanges.find({ where: { user_id: userId }, order: { created_at: 'DESC' } });
  }
  async pending() {
    const operations = await this.exchanges.find({
      where: { status: 'PENDING_REVIEW' },
      order: { created_at: 'ASC' },
    });
    if (!operations.length) return [];
    // Una consulta para todos los eventos evita N+1; no cargar relaciones de forma eager.
    const events = await this.auditEvents.find({
      where: { exchange_id: In(operations.map((exchange) => exchange.id)) },
      order: { created_at: 'ASC', id: 'ASC' },
    });
    const byExchange = new Map<string, AuditEvent[]>();
    for (const event of events) {
      const group = byExchange.get(event.exchange_id) ?? [];
      group.push(event);
      byExchange.set(event.exchange_id, group);
    }
    return operations.map((exchange) => ({
      ...exchange,
      events: byExchange.get(exchange.id) ?? null,
    }));
  }

  /** Bloquear la operación evita decisiones simultáneas; conservar el precio original aunque expire. */
  async decide(actorId: string, id: string, approve: boolean) {
    return this.dataSource.transaction(async (manager) => {
      const operations = manager.getRepository(Exchange);
      const exchange = await operations.findOne({
        where: { id },
        lock: { mode: 'pessimistic_write' },
      });
      if (!exchange) throw new NotFoundException('Exchange not found');
      if (exchange.status !== 'PENDING_REVIEW')
        throw new ConflictException('Exchange already decided');
      const quote = await manager.getRepository(Quote).findOneByOrFail({ id: exchange.quote_id });
      const { source, target } = await this.lockUserWallets(
        manager,
        exchange.user_id,
        quote.source_asset,
        quote.target_asset,
      );
      const debit = new Decimal(exchange.amount).negated().toFixed(8);
      await this.ledger.move(
        manager,
        source.id,
        id,
        approve ? 'DEBIT' : 'RELEASE',
        approve ? '0' : exchange.amount,
        debit,
      );
      if (approve) await this.ledger.move(manager, target.id, id, 'CREDIT', exchange.received);
      const status: Exchange['status'] = approve ? 'COMPLETED' : 'REJECTED';
      await operations.update({ id }, { status });
      await this.audit(manager, id, actorId, status);
      return operations.findOneByOrFail({ id });
    });
  }

  /** Orden fijo por ID para reducir deadlocks entre intercambios y decisiones. */
  private async lockUserWallets(
    manager: EntityManager,
    userId: string,
    sourceAsset: string,
    targetAsset: string,
  ) {
    const wallets = await manager
      .getRepository(WalletAsset)
      .createQueryBuilder('wallet')
      .innerJoin('wallet.wallet', 'owner')
      .where('owner.user_id = :userId', { userId })
      .andWhere('wallet.asset IN (:...assets)', { assets: [sourceAsset, targetAsset] })
      .orderBy('wallet.id', 'ASC')
      .setLock('pessimistic_write', undefined, ['wallet'])
      .getMany();
    const source = wallets.find((wallet) => wallet.asset === sourceAsset);
    const target = wallets.find((wallet) => wallet.asset === targetAsset);
    if (!source || !target)
      throw new InternalServerErrorException('User wallets are not initialized');
    return { source, target };
  }
  private eventsFor(exchangeId: string) {
    return this.auditEvents.find({
      where: { exchange_id: exchangeId },
      order: { created_at: 'ASC', id: 'ASC' },
    });
  }
  /** Auditoría e idempotencia usan el mismo manager que el ledger, nunca un repositorio global. */
  private async audit(
    manager: EntityManager,
    exchangeId: string,
    actorId: string,
    event: string,
    details: Record<string, unknown> = {},
  ) {
    const repository = manager.getRepository(AuditEvent);
    await repository.save(
      repository.create({ exchange_id: exchangeId, actor_id: actorId, event, details }),
    );
  }
}
