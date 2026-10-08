import 'reflect-metadata';
import { Test } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { Pool } from 'pg';
import { DataSource } from 'typeorm';
import { databaseOptions } from '../src/database/database.config';
import { Server } from 'node:http';
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { AppModule } from '../src/app.module';
import { configureSwagger } from '../src/docs/swagger';
import { initializeSchema } from '../src/database/initialize';
import { seed } from '../src/database/seed';
const { createApp } = require('../../compliance-mock/src/app');

describe('API integration — real PostgreSQL and HTTP compliance mock', () => {
  let app: INestApplication,
    pool: Pool,
    dataSource: DataSource,
    mock: Server,
    dir: string,
    config: string;
  const user = 'user-001',
    compliance = 'compliance-001';
  const configure = (extra = {}) =>
    writeFileSync(
      config,
      JSON.stringify({
        lowBelow: '1000',
        mediumThrough: '5000',
        forceFailure: false,
        delayMs: 0,
        ...extra,
      }),
    );
  const quotes = (amount: string) =>
    request(app.getHttpServer()).post('/quotes').set('X-User-Id', user).send({ amount });
  const exchange = (quoteId: string, key = quoteId) =>
    request(app.getHttpServer())
      .post('/exchanges')
      .set('X-User-Id', user)
      .set('Idempotency-Key', key)
      .send({ quoteId });
  const decision = (id: string, action = 'approve', actor = compliance) =>
    request(app.getHttpServer())
      .patch(`/compliance/exchanges/${id}/${action}`)
      .set('X-User-Id', actor);
  const balances = async () =>
    (
      await pool.query(
        "SELECT b.* FROM wallet_assets b JOIN wallets w ON w.id=b.wallet_id WHERE w.user_id=$1 AND b.asset='USDT-SBX'",
        [user],
      )
    ).rows[0];
  const movementCount = async () =>
    Number(
      (await pool.query('SELECT count(*) FROM ledger WHERE exchange_id IS NOT NULL')).rows[0].count,
    );
  beforeAll(async () => {
    const url =
      process.env.TEST_DATABASE_URL || 'postgresql://sandbox:sandbox@localhost:55432/assets_test';
    if (!new URL(url).pathname.endsWith('_test'))
      throw new Error('Tests require a dedicated database ending in _test');
    process.env.DATABASE_URL = url;
    pool = new Pool({ connectionString: url });
    dataSource = await new DataSource(databaseOptions(url)).initialize();
    await initializeSchema(dataSource);
    dir = mkdtempSync(join(tmpdir(), 'assets-mock-'));
    config = join(dir, 'config.json');
    configure();
    mock = createApp(config).listen(0);
    await new Promise<void>((resolve) =>
      mock.listening ? resolve() : mock.once('listening', resolve),
    );
    process.env.COMPLIANCE_URL = `http://127.0.0.1:${(mock.address() as any).port}`;
    const module = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = module.createNestApplication();
    app.useLogger(false);
    app.useGlobalPipes(
      new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }),
    );
    configureSwagger(app);
    await app.init();
  });
  beforeEach(async () => {
    await pool.query(
      'TRUNCATE idempotency_keys,audit_events,ledger,exchanges,quotes,wallets,users,assets CASCADE',
    );
    await seed(dataSource);
    configure();
  });
  afterAll(async () => {
    if (app) await app.close();
    if (dataSource?.isInitialized) await dataSource.destroy();
    if (pool) await pool.end();
    if (mock)
      await new Promise<void>((resolve, reject) => mock.close((e) => (e ? reject(e) : resolve())));
    if (dir) rmSync(dir, { recursive: true });
  });
  it('serves Swagger UI and its assets without identity', async () => {
    await request(app.getHttpServer()).get('/docs').expect(200).expect('Content-Type', /html/);
    await request(app.getHttpServer()).get('/docs/').expect(200).expect('Content-Type', /html/);
    await request(app.getHttpServer()).get('/docs/swagger-ui.css').expect(200);
    await request(app.getHttpServer()).get('/docs-yaml').expect(200);
    await request(app.getHttpServer()).get('/docs/swagger-ui-init.js').expect(200);
  });
  it('publishes OpenAPI schemas, identity header, idempotency and error responses', async () => {
    const { body } = await request(app.getHttpServer()).get('/docs-json').expect(200);
    expect(body.components.securitySchemes.userIdentity).toMatchObject({
      type: 'apiKey',
      in: 'header',
      name: 'X-User-Id',
    });
    const endpoints = [
      '/wallets',
      '/wallets/{id}/movements',
      '/quotes',
      '/exchanges',
      '/exchanges/{id}',
      '/compliance/exchanges/pending',
      '/compliance/exchanges/{id}',
      '/compliance/exchanges/{id}/approve',
      '/compliance/exchanges/{id}/reject',
    ];
    for (const path of endpoints) {
      expect(body.paths[path]).toBeDefined();
      for (const operation of Object.values(body.paths[path]) as any[]) {
        expect(operation.security).toEqual([{ userIdentity: [] }]);
        expect(operation.responses['401']).toBeDefined();
        expect(operation.responses['403']).toBeDefined();
      }
    }
    const creation = body.paths['/exchanges'].post;
    expect(creation.parameters).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ name: 'Idempotency-Key', in: 'header', required: true }),
      ]),
    );
    expect(creation.responses['503'].content['application/json'].schema.$ref).toBe(
      '#/components/schemas/ExchangeResponseDto',
    );
    expect(body.components.schemas.QuoteDto.properties.amount.type).toBe('string');
    const moneyPattern = new RegExp(body.components.schemas.QuoteDto.properties.amount.pattern);
    expect(moneyPattern.test('2500.12345678')).toBe(true);
    expect(moneyPattern.test('2500.123456789')).toBe(false);
    expect(body.components.schemas.ExchangeDetailResponseDto.properties.events.items.$ref).toBe(
      '#/components/schemas/AuditEventResponseDto',
    );
  });
  it('supports another catalog asset without schema changes and enforces balance integrity', async () => {
    const container = (await pool.query('SELECT id FROM wallets WHERE user_id=$1', [user])).rows[0]
      .id;
    await pool.query("INSERT INTO assets(code,name) VALUES ('BTC-SBX','Sandbox Bitcoin')");
    await pool.query("INSERT INTO wallet_assets(wallet_id,asset) VALUES ($1,'BTC-SBX')", [
      container,
    ]);
    const response = await request(app.getHttpServer())
      .get('/wallets')
      .set('X-User-Id', user)
      .expect(200);
    expect(response.body).toHaveLength(3);
    expect(response.body.find((b: any) => b.asset === 'BTC-SBX')).toMatchObject({
      wallet_id: container,
      user_id: user,
      available: '0.00000000',
    });
    await expect(
      pool.query("INSERT INTO wallet_assets(wallet_id,asset) VALUES ($1,'BTC-SBX')", [container]),
    ).rejects.toThrow(/unique constraint/);
    await expect(
      pool.query("INSERT INTO wallet_assets(wallet_id,asset) VALUES ($1,'UNKNOWN')", [container]),
    ).rejects.toThrow(/foreign key constraint/);
    await expect(pool.query("DELETE FROM assets WHERE code='BTC-SBX'")).rejects.toThrow(
      /foreign key constraint/,
    );
  });
  it('scopes balance history through the wallet owner and retains the balance ID route', async () => {
    const response = await request(app.getHttpServer())
      .get('/wallets')
      .set('X-User-Id', user)
      .expect(200);
    const balance = response.body.find((b: any) => b.asset === 'USDT-SBX');
    const history = await request(app.getHttpServer())
      .get(`/wallets/${balance.id}/movements`)
      .set('X-User-Id', user)
      .expect(200);
    expect(history.body[0].wallet_asset_id).toBe(balance.id);
    await pool.query("INSERT INTO users(id,role) VALUES ('other-user','USER')");
    await request(app.getHttpServer())
      .get(`/wallets/${balance.id}/movements`)
      .set('X-User-Id', 'other-user')
      .expect(404);
  });
  it('LOW completes with exact balances and two movements', async () => {
    const q = await quotes('500').expect(201);
    const e = await exchange(q.body.id).expect(201);
    expect(e.body.status).toBe('COMPLETED');
    expect(e.body.received).toBe('0.19800000');
    expect((await balances()).available).toBe('9500.00000000');
    expect(await movementCount()).toBe(2);
  });
  it.each(['1000', '2500', '5000'])(
    'MEDIUM %s completes and requires follow up',
    async (amount) => {
      const q = await quotes(amount).expect(201);
      const e = await exchange(q.body.id).expect(201);
      expect(e.body.status).toBe('COMPLETED');
      expect(e.body.requires_follow_up).toBe(true);
    },
  );
  it('insufficient funds has no monetary effects', async () => {
    const q = await quotes('10001').expect(201);
    await exchange(q.body.id).expect(400);
    expect((await balances()).available).toBe('10000.00000000');
    expect(await movementCount()).toBe(0);
  });
  it('expired quote cannot execute', async () => {
    const q = await quotes('500').expect(201);
    await pool.query(
      "UPDATE quotes SET expires_at=clock_timestamp()-interval '1 second' WHERE id=$1",
      [q.body.id],
    );
    await exchange(q.body.id).expect(400);
    expect(await movementCount()).toBe(0);
  });
  it('same idempotency key returns original response without duplicate movements', async () => {
    const q = await quotes('500').expect(201);
    const first = await exchange(q.body.id, 'repeat').expect(201);
    const second = await exchange(q.body.id, 'repeat').expect(201);
    expect(second.body).toEqual(first.body);
    expect(await movementCount()).toBe(2);
  });
  it('same key with different payload returns 409', async () => {
    const a = await quotes('500');
    const b = await quotes('600');
    await exchange(a.body.id, 'key').expect(201);
    await exchange(b.body.id, 'key').expect(409);
    expect(await movementCount()).toBe(2);
  });
  it('HIGH reserves available funds and keeps total', async () => {
    const q = await quotes('6000');
    const e = await exchange(q.body.id).expect(201);
    expect(e.body.status).toBe('PENDING_REVIEW');
    const w = await balances();
    expect(w.available).toBe('4000.00000000');
    expect(w.held).toBe('6000.00000000');
    expect(w.total).toBe('10000.00000000');
  });
  it('approval after expiry uses original quote and clears hold', async () => {
    const q = await quotes('6000');
    const e = await exchange(q.body.id);
    await pool.query(
      "UPDATE quotes SET expires_at=clock_timestamp()-interval '1 second' WHERE id=$1",
      [q.body.id],
    );
    const approved = await decision(e.body.id).expect(200);
    expect(approved.body.received).toBe('2.37600000');
    expect(approved.body.status).toBe('COMPLETED');
    expect((await balances()).held).toBe('0.00000000');
    expect(await movementCount()).toBe(3);
  });
  it('rejection releases hold and never credits destination', async () => {
    const q = await quotes('6000');
    const e = await exchange(q.body.id);
    await decision(e.body.id, 'reject').expect(200);
    const w = await balances();
    expect(w.available).toBe('10000.00000000');
    expect(w.held).toBe('0.00000000');
    const x = (
      await pool.query(
        "SELECT b.available FROM wallet_assets b JOIN wallets w ON w.id=b.wallet_id WHERE w.user_id=$1 AND b.asset='XAUT-SBX'",
        [user],
      )
    ).rows[0];
    expect(x.available).toBe('0.00000000');
  });
  it('user without compliance role cannot approve', async () => {
    const q = await quotes('6000');
    const e = await exchange(q.body.id);
    await decision(e.body.id, 'approve', user).expect(403);
  });
  it('missing or unknown identity returns 401', async () => {
    await request(app.getHttpServer()).get('/wallets').expect(401);
    await request(app.getHttpServer()).get('/wallets').set('X-User-Id', 'unknown').expect(401);
  });
  it('mock failure persists FAILED without changing wallets', async () => {
    configure({ forceFailure: true });
    const q = await quotes('500');
    const e = await exchange(q.body.id).expect(503);
    expect(e.body.status).toBe('FAILED');
    expect((await balances()).available).toBe('10000.00000000');
    expect(await movementCount()).toBe(0);
    await exchange(q.body.id).expect(503);
  });
  it('prevents double spend: concurrent 6000 requests against 10000', async () => {
    configure({ delayMs: 80 });
    const a = await quotes('6000');
    const b = await quotes('6000');
    const responses = await Promise.all([exchange(a.body.id), exchange(b.body.id)]);
    expect(responses.map((r) => r.status).sort()).toEqual([201, 400]);
    const w = await balances();
    expect(w.available).toBe('4000.00000000');
    expect(w.held).toBe('6000.00000000');
    expect(await movementCount()).toBe(1);
    await decision(responses.find((r) => r.status === 201)!.body.id).expect(200);
    expect((await balances()).total).toBe('4000.00000000');
    expect(await movementCount()).toBe(3);
  });
  it('prevents concurrent automatic debits exceeding available balance', async () => {
    const initial = await quotes('4000');
    await exchange(initial.body.id).expect(201);
    configure({ delayMs: 80 });
    const a = await quotes('4000');
    const b = await quotes('4000');
    const results = await Promise.all([exchange(a.body.id), exchange(b.body.id)]);
    expect(results.map((r) => r.status).sort()).toEqual([201, 400]);
    const w = await balances();
    expect(w.available).toBe('2000.00000000');
    expect(w.held).toBe('0.00000000');
    expect(await movementCount()).toBe(4);
    const x = (
      await pool.query(
        "SELECT b.available FROM wallet_assets b JOIN wallets w ON w.id=b.wallet_id WHERE w.user_id=$1 AND b.asset='XAUT-SBX'",
        [user],
      )
    ).rows[0];
    expect(x.available).toBe('3.16800000');
  });
  it('concurrent same-key requests produce exactly one exchange', async () => {
    configure({ delayMs: 50 });
    const q = await quotes('500');
    const [a, b] = await Promise.all([exchange(q.body.id, 'same'), exchange(q.body.id, 'same')]);
    expect(a.status).toBe(201);
    expect(b.body).toEqual(a.body);
    expect(await movementCount()).toBe(2);
  });
  it('same quote with different concurrent keys executes once', async () => {
    const q = await quotes('500');
    const results = await Promise.all([exchange(q.body.id, 'a'), exchange(q.body.id, 'b')]);
    expect(results.map((r) => r.status).sort()).toEqual([201, 409]);
    expect(await movementCount()).toBe(2);
  });
  it('concurrent approve and reject produces one decision', async () => {
    const q = await quotes('6000');
    const e = await exchange(q.body.id);
    const results = await Promise.all([decision(e.body.id), decision(e.body.id, 'reject')]);
    expect(results.map((r) => r.status).sort()).toEqual([200, 409]);
    expect((await balances()).held).toBe('0.00000000');
  });
  it('failure while crediting rolls back debit, ledger, exchange and quote', async () => {
    const q = await quotes('500');
    await pool.query(`CREATE OR REPLACE FUNCTION test_fail_credit() RETURNS trigger LANGUAGE plpgsql AS $$
    BEGIN IF NEW.type='CREDIT' THEN RAISE EXCEPTION 'Injected credit failure'; END IF; RETURN NEW; END $$;
    CREATE TRIGGER test_credit_failure BEFORE INSERT ON ledger FOR EACH ROW EXECUTE FUNCTION test_fail_credit();`);
    try {
      await exchange(q.body.id).expect(500);
      expect((await balances()).available).toBe('10000.00000000');
      expect(await movementCount()).toBe(0);
      expect(
        (await pool.query('SELECT status FROM quotes WHERE id=$1', [q.body.id])).rows[0].status,
      ).toBe('ACTIVE');
      expect(Number((await pool.query('SELECT count(*) FROM exchanges')).rows[0].count)).toBe(0);
      expect(
        Number((await pool.query('SELECT count(*) FROM idempotency_keys')).rows[0].count),
      ).toBe(0);
    } finally {
      await pool.query(
        'DROP TRIGGER test_credit_failure ON ledger; DROP FUNCTION test_fail_credit();',
      );
    }
  });
  it('compliance can read decision trace after approval', async () => {
    const q = await quotes('6000');
    const e = await exchange(q.body.id);
    await decision(e.body.id).expect(200);
    const detail = await request(app.getHttpServer())
      .get(`/compliance/exchanges/${e.body.id}`)
      .set('X-User-Id', compliance)
      .expect(200);
    expect(detail.body.events.map((a: any) => a.event)).toEqual(['PENDING_REVIEW', 'COMPLETED']);
    expect(detail.body.events[1].actor_id).toBe(compliance);
  });
  it('database prohibits direct balance edits and history edits', async () => {
    await expect(
      pool.query(
        'UPDATE wallet_assets SET available=1 WHERE wallet_id IN (SELECT id FROM wallets WHERE user_id=$1)',
        [user],
      ),
    ).rejects.toThrow('Balances must change through ledger');
    await expect(pool.query("UPDATE ledger SET reference='changed'")).rejects.toThrow(
      'Confirmed history is immutable',
    );
  });
  it('seed is repeatable without additional funding', async () => {
    await seed(dataSource);
    expect((await balances()).available).toBe('10000.00000000');
    expect(Number((await pool.query('SELECT count(*) FROM ledger')).rows[0].count)).toBe(1);
  });
  it('rejects numeric money, excess precision and unexpected fields', async () => {
    for (const body of [{ amount: 500 }, { amount: '1.123456789' }, { amount: '500', extra: true }])
      await request(app.getHttpServer())
        .post('/quotes')
        .set('X-User-Id', user)
        .send(body)
        .expect(400);
  });
});
