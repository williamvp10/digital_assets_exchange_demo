import { BadRequestException, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import Decimal from 'decimal.js';
import { Quote } from '../database/entities/quote.entity';

// Precisión suficiente para NUMERIC(28,8) y cálculos intermedios.
Decimal.set({ precision: 40 });

/** Calcula una vez los importes y guarda la cotización que consumirá el intercambio. */
@Injectable()
export class QuotesService {
  constructor(@InjectRepository(Quote) private readonly quotes: Repository<Quote>) {}
  async create(userId: string, amount: string) {
    const value = new Decimal(amount);
    const fee = value.mul('0.01').toDecimalPlaces(8, Decimal.ROUND_DOWN);
    const received = value.minus(fee).div('2500').toDecimalPlaces(8, Decimal.ROUND_DOWN);
    if (!value.isPositive() || !received.isPositive())
      throw new BadRequestException('Amount too small');
    // El reloj de PostgreSQL determina la vigencia; los montos se reutilizan sin recalcular.
    const result = await this.quotes
      .createQueryBuilder()
      .insert()
      .values({
        user_id: userId,
        amount: value.toFixed(8),
        price: '2500.00000000',
        fee: fee.toFixed(8),
        received: received.toFixed(8),
        expires_at: () => "clock_timestamp() + interval '30 seconds'",
      })
      .returning('*')
      .execute();
    const inserted: Quote[] = result.raw;
    return inserted[0];
  }
}
