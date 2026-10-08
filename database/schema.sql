CREATE TABLE IF NOT EXISTS users (
 id text PRIMARY KEY, role text NOT NULL CHECK (role IN ('USER','COMPLIANCE'))
);
CREATE TABLE IF NOT EXISTS assets (
 code text PRIMARY KEY, name text NOT NULL
);
CREATE TABLE IF NOT EXISTS wallets (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 user_id text NOT NULL UNIQUE REFERENCES users(id)
);
CREATE TABLE IF NOT EXISTS wallet_assets (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 wallet_id uuid NOT NULL REFERENCES wallets(id),
 asset text NOT NULL REFERENCES assets(code),
 available numeric(28,8) NOT NULL DEFAULT 0 CHECK(available >= 0),
 held numeric(28,8) NOT NULL DEFAULT 0 CHECK(held >= 0),
 total numeric(28,8) GENERATED ALWAYS AS (available + held) STORED,
 UNIQUE(wallet_id,asset)
);
CREATE TABLE IF NOT EXISTS quotes (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), user_id text NOT NULL REFERENCES users(id),
 source_asset text NOT NULL DEFAULT 'USDT-SBX' REFERENCES assets(code), target_asset text NOT NULL DEFAULT 'XAUT-SBX' REFERENCES assets(code),
 amount numeric(28,8) NOT NULL CHECK(amount > 0), price numeric(28,8) NOT NULL,
 fee numeric(28,8) NOT NULL, received numeric(28,8) NOT NULL CHECK(received > 0),
 created_at timestamptz NOT NULL DEFAULT clock_timestamp(), expires_at timestamptz NOT NULL,
 status text NOT NULL DEFAULT 'ACTIVE' CHECK(status IN ('ACTIVE','EXPIRED','USED'))
);
CREATE TABLE IF NOT EXISTS exchanges (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), user_id text NOT NULL REFERENCES users(id),
 quote_id uuid NOT NULL REFERENCES quotes(id),
 status text NOT NULL CHECK(status IN ('CREATED','PROCESSING','PENDING_REVIEW','COMPLETED','REJECTED','FAILED')),
 risk text CHECK(risk IN ('LOW','MEDIUM','HIGH')), requires_follow_up boolean NOT NULL DEFAULT false,
 amount numeric(28,8) NOT NULL, price numeric(28,8) NOT NULL, fee numeric(28,8) NOT NULL,
 received numeric(28,8) NOT NULL, created_at timestamptz NOT NULL DEFAULT clock_timestamp()
);
CREATE UNIQUE INDEX IF NOT EXISTS consumed_quote ON exchanges(quote_id) WHERE status <> 'FAILED';
CREATE TABLE IF NOT EXISTS idempotency_keys (
 user_id text NOT NULL REFERENCES users(id), key text NOT NULL, request_hash text NOT NULL,
 exchange_id uuid NOT NULL REFERENCES exchanges(id), response_status integer NOT NULL,
 response_body jsonb NOT NULL, PRIMARY KEY(user_id,key)
);
CREATE TABLE IF NOT EXISTS ledger (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), wallet_asset_id uuid NOT NULL REFERENCES wallet_assets(id),
 exchange_id uuid REFERENCES exchanges(id), reference text NOT NULL,
 type text NOT NULL CHECK(type IN ('DEBIT','CREDIT','HOLD','RELEASE','SEED')),
 available_delta numeric(28,8) NOT NULL, held_delta numeric(28,8) NOT NULL,
 available_before numeric(28,8) NOT NULL, available_after numeric(28,8) NOT NULL CHECK(available_after >= 0),
 held_before numeric(28,8) NOT NULL, held_after numeric(28,8) NOT NULL CHECK(held_after >= 0),
 status text NOT NULL DEFAULT 'CONFIRMED' CHECK(status = 'CONFIRMED'),
 created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
 CHECK(available_after = available_before + available_delta), CHECK(held_after = held_before + held_delta)
);
CREATE TABLE IF NOT EXISTS audit_events (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), exchange_id uuid NOT NULL REFERENCES exchanges(id),
 actor_id text NOT NULL REFERENCES users(id), event text NOT NULL, details jsonb NOT NULL DEFAULT '{}',
 created_at timestamptz NOT NULL DEFAULT clock_timestamp()
);
CREATE INDEX IF NOT EXISTS ledger_wallet ON ledger(wallet_asset_id,created_at);
CREATE INDEX IF NOT EXISTS exchange_owner ON exchanges(user_id,created_at);
CREATE INDEX IF NOT EXISTS pending_exchanges ON exchanges(status) WHERE status='PENDING_REVIEW';
CREATE OR REPLACE FUNCTION prevent_history_mutation() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN RAISE EXCEPTION 'Confirmed history is immutable'; END $$;
DROP TRIGGER IF EXISTS immutable_ledger ON ledger;
CREATE TRIGGER immutable_ledger BEFORE UPDATE OR DELETE ON ledger FOR EACH ROW EXECUTE FUNCTION prevent_history_mutation();
DROP TRIGGER IF EXISTS immutable_audit ON audit_events;
CREATE TRIGGER immutable_audit BEFORE UPDATE OR DELETE ON audit_events FOR EACH ROW EXECUTE FUNCTION prevent_history_mutation();
-- Los saldos por activo solo se modifican mediante movimientos del ledger.
CREATE OR REPLACE FUNCTION apply_ledger() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE w wallet_assets%ROWTYPE;
BEGIN
 SELECT * INTO w FROM wallet_assets WHERE id=NEW.wallet_asset_id FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Wallet asset not initialized'; END IF;
 IF w.available <> NEW.available_before OR w.held <> NEW.held_before THEN
   RAISE EXCEPTION 'Stale ledger balance';
 END IF;
 UPDATE wallet_assets SET available=NEW.available_after,held=NEW.held_after WHERE id=NEW.wallet_asset_id;
 RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS ledger_applies_balance ON ledger;
CREATE TRIGGER ledger_applies_balance AFTER INSERT ON ledger FOR EACH ROW EXECUTE FUNCTION apply_ledger();
CREATE OR REPLACE FUNCTION guard_wallet_balance() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF (NEW.available <> OLD.available OR NEW.held <> OLD.held) AND pg_trigger_depth() < 2 THEN
   RAISE EXCEPTION 'Balances must change through ledger';
 END IF;
 RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS wallet_balance_guard ON wallet_assets;
CREATE TRIGGER wallet_balance_guard BEFORE UPDATE ON wallet_assets FOR EACH ROW EXECUTE FUNCTION guard_wallet_balance();
