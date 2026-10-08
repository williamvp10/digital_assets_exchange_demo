# Arquitectura

```mermaid
flowchart TD
 U[Usuario] --> I[Middleware de identificación y roles]
 C[Cumplimiento] --> I
 subgraph NestJS
 I --> W[Wallets]
 I --> Q[Cotizaciones]
 I --> E[Intercambios y revisión]
 E --> M[Adaptador de monitoreo HTTP]
 E --> L[Ledger y transacción]
 end
 M --> X[Express mock configurable por JSON]
 W --> ORM[TypeORM: repositorios y EntityManager]
 Q --> ORM
 L --> ORM
 ORM --> DB[(PostgreSQL)]
 DB --- T[Usuarios / Activos / Wallets / Saldos / Cotizaciones / Intercambios / Ledger / Idempotencia / Auditoría]
```

El proveedor de liquidez tiene inventario supuesto suficiente; no necesita componente real. Consulta externa antes del bloqueo; transacción y revalidación para todos los cambios monetarios.

## Modelo entidad-relación de PostgreSQL

El diagrama refleja las tablas financieras y claves de `database/schema.sql`, mapeadas en `apps/api/src/database/entities/`. `PK` indica clave primaria y `FK` clave foránea. Los campos monetarios `numeric` usan precisión `numeric(28,8)`.

```mermaid
erDiagram
    users ||--o| wallets : posee
    users ||--o{ quotes : solicita
    users ||--o{ exchanges : realiza
    users ||--o{ idempotency_keys : identifica_solicitudes
    users ||--o{ audit_events : actua
    wallets ||--o{ wallet_assets : contiene
    assets ||--o{ wallet_assets : denomina
    wallet_assets ||--o{ ledger : registra_movimientos
    assets ||--o{ quotes : origen
    assets ||--o{ quotes : destino
    quotes ||--o{ exchanges : origina_intentos
    exchanges |o--o{ ledger : referencia
    exchanges ||--o{ idempotency_keys : conserva_respuesta
    exchanges ||--o{ audit_events : registra_trazabilidad

    users {
        text id PK
        text role "USER o COMPLIANCE"
    }

    wallets {
        uuid id PK
        text user_id FK
    }

    assets {
        text code PK
        text name
    }

    wallet_assets {
        uuid id PK
        uuid wallet_id FK
        text asset FK "Referencia assets.code"
        numeric available "Saldo disponible no negativo"
        numeric held "Saldo retenido no negativo"
        numeric total "Generado: available + held"
    }

    quotes {
        uuid id PK
        text user_id FK
        text source_asset FK
        text target_asset FK
        numeric amount
        numeric price
        numeric fee
        numeric received
        timestamptz created_at
        timestamptz expires_at
        text status "ACTIVE, EXPIRED, USED"
    }

    exchanges {
        uuid id PK
        text user_id FK
        uuid quote_id FK
        text status "Estado de la operacion"
        text risk "LOW, MEDIUM, HIGH; nullable"
        boolean requires_follow_up
        numeric amount
        numeric price
        numeric fee
        numeric received
        timestamptz created_at
    }

    idempotency_keys {
        text user_id PK, FK "PK compuesta con key"
        text key PK "PK compuesta con user_id"
        text request_hash
        uuid exchange_id FK
        integer response_status
        jsonb response_body
    }

    ledger {
        uuid id PK
        uuid wallet_asset_id FK
        uuid exchange_id FK "Nullable para financiacion inicial"
        text reference
        text type "DEBIT, CREDIT, HOLD, RELEASE, SEED"
        numeric available_delta
        numeric held_delta
        numeric available_before
        numeric available_after
        numeric held_before
        numeric held_after
        text status "CONFIRMED"
        timestamptz created_at
    }

    audit_events {
        uuid id PK
        uuid exchange_id FK
        text actor_id FK
        text event
        jsonb details
        timestamptz created_at
    }
```


## Persistencia con TypeORM

Los módulos registran repositorios por entidad. Las lecturas usan repositorios inyectados; las escrituras monetarias usan repositorios obtenidos del `EntityManager` de la transacción. `pessimistic_write` genera los bloqueos PostgreSQL. Los triggers y checks siguen siendo la última defensa del ledger; no se reemplazan por lógica exclusiva del ORM.

## Inicialización

`npm run db:init` aplica `database/schema.sql` en una transacción. El esquema incluye el catálogo `assets`, una wallet por usuario y los saldos en `wallet_assets`, con unicidad `(wallet_id, asset)`. El ledger referencia cada saldo por `wallet_asset_id`. El seed crea los activos y datos de prueba sin duplicar fondos.

`GET /wallets` devuelve saldos por activo: `id` identifica el saldo y `wallet_id` su contenedor. `/wallets/:id/movements` recibe el ID de saldo. El catálogo admite nuevos activos; el intercambio sigue usando el par del reto.

## Diagrama para DrawDB (DBML)

[Descargar el modelo DBML](database.drawdb.dbml) y usar la importación DBML de la plataforma, o copiar el siguiente contenido. Las nueve tablas y sus claves foráneas corresponden a `database/schema.sql`. Los UUID se generan con `gen_random_uuid()`; no son enteros autoincrementales. La propiedad `headercolor` conserva el formato del ejemplo.

La visualización incluye la PK compuesta de `idempotency_keys` y la unicidad `(wallet_id, asset)`. Los checks monetarios, estados permitidos, índices parciales y triggers se mantienen en el SQL. `ledger.exchange_id` es opcional para la financiación inicial; `wallet_assets.total` es una columna generada.

```dbml
// Modelo PostgreSQL de database/schema.sql.
// Los checks, índices parciales y triggers se definen en el SQL.

Table users [headercolor: #175e7a] {
  id text [pk, not null]
  role text [not null]
}

Table assets [headercolor: #175e7a] {
  code text [pk, not null]
  name text [not null]
}

Table wallets [headercolor: #175e7a] {
  id uuid [pk, not null, default: `gen_random_uuid()`]
  user_id text [not null, unique]
}

Table wallet_assets [headercolor: #175e7a] {
  id uuid [pk, not null, default: `gen_random_uuid()`]
  wallet_id uuid [not null]
  asset text [not null]
  available numeric(28,8) [not null, default: 0]
  held numeric(28,8) [not null, default: 0]
  total numeric(28,8) [note: 'Generado en PostgreSQL: available + held']

  indexes {
    (wallet_id,asset) [unique]
  }
}

Table quotes [headercolor: #175e7a] {
  id uuid [pk, not null, default: `gen_random_uuid()`]
  user_id text [not null]
  source_asset text [not null, default: 'USDT-SBX']
  target_asset text [not null, default: 'XAUT-SBX']
  amount numeric(28,8) [not null]
  price numeric(28,8) [not null]
  fee numeric(28,8) [not null]
  received numeric(28,8) [not null]
  created_at timestamptz [not null, default: `clock_timestamp()`]
  expires_at timestamptz [not null]
  status text [not null, default: 'ACTIVE']
}

Table exchanges [headercolor: #175e7a] {
  id uuid [pk, not null, default: `gen_random_uuid()`]
  user_id text [not null]
  quote_id uuid [not null]
  status text [not null]
  risk text
  requires_follow_up boolean [not null, default: false]
  amount numeric(28,8) [not null]
  price numeric(28,8) [not null]
  fee numeric(28,8) [not null]
  received numeric(28,8) [not null]
  created_at timestamptz [not null, default: `clock_timestamp()`]
}

Table idempotency_keys [headercolor: #175e7a] {
  user_id text [not null]
  key text [not null]
  request_hash text [not null]
  exchange_id uuid [not null]
  response_status integer [not null]
  response_body jsonb [not null]

  indexes {
    (user_id,key) [pk]
  }
}

Table ledger [headercolor: #175e7a] {
  id uuid [pk, not null, default: `gen_random_uuid()`]
  wallet_asset_id uuid [not null]
  exchange_id uuid
  reference text [not null]
  type text [not null]
  available_delta numeric(28,8) [not null]
  held_delta numeric(28,8) [not null]
  available_before numeric(28,8) [not null]
  available_after numeric(28,8) [not null]
  held_before numeric(28,8) [not null]
  held_after numeric(28,8) [not null]
  status text [not null, default: 'CONFIRMED']
  created_at timestamptz [not null, default: `clock_timestamp()`]
}

Table audit_events [headercolor: #175e7a] {
  id uuid [pk, not null, default: `gen_random_uuid()`]
  exchange_id uuid [not null]
  actor_id text [not null]
  event text [not null]
  details jsonb [not null, default: '{}']
  created_at timestamptz [not null, default: `clock_timestamp()`]
}

Ref: wallets.user_id - users.id
Ref: wallet_assets.wallet_id > wallets.id
Ref: wallet_assets.asset > assets.code
Ref: quotes.user_id > users.id
Ref: quotes.source_asset > assets.code
Ref: quotes.target_asset > assets.code
Ref: exchanges.user_id > users.id
Ref: exchanges.quote_id > quotes.id
Ref: idempotency_keys.user_id > users.id
Ref: idempotency_keys.exchange_id > exchanges.id
Ref: ledger.wallet_asset_id > wallet_assets.id
Ref: ledger.exchange_id > exchanges.id
Ref: audit_events.exchange_id > exchanges.id
Ref: audit_events.actor_id > users.id
```
