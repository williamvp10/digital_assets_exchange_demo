# Guía para leer y mantener la API

## Orden recomendado

1. `apps/api/src/main.ts`: arranque, validación global, Swagger y cierre ordenado.
2. `apps/api/src/app.module.ts`: módulos y orden de middlewares. Swagger queda público; los controladores de negocio requieren identificación y rol.
3. `apps/api/src/auth/auth.middleware.ts`: identidad desde DB, rol permitido y errores 401/403. Un rol autorizado no implica propiedad: cada servicio filtra sus recursos por usuario.
4. `apps/api/src/quotes/quotes.service.ts`: cálculo decimal, comisión, redondeo y persistencia de cotización.
5. `apps/api/src/exchanges/exchanges.service.ts`: creación, idempotencia, bloqueos, retención y decisiones.
6. `apps/api/src/ledger/ledger.service.ts` y `database/schema.sql`: movimientos, triggers y restricciones del esquema inicial.
7. `apps/api/test/exchanges.e2e.spec.ts`: evidencia de los flujos HTTP, rollback y concurrencia con PostgreSQL real.

## Responsabilidades de los archivos

- `*.module.ts`: registra controladores y proveedores; no contiene lógica del negocio.
- `*.controller.ts`: recibe HTTP, delega al servicio y documenta el contrato Swagger.
- `dto/`: describe y valida entradas. Los DTOs de respuesta de `docs/responses.dto.ts` describen el JSON; no se usan como modelo de dominio.
- `*.service.ts`: reglas de negocio y repositorios inyectados. Los nombres `manager`, `lockedQuote`, `source` y `target` identifican el contexto transaccional, cotización bloqueada y saldos por activo origen/destino.
- `database/entities/`: las nueve entidades con columnas y relaciones; NUMERIC permanece como texto. Sin cascadas ni relaciones eager para evitar escrituras implícitas y consultas innecesarias.
- `database/database.module.ts`: integración de NestJS con TypeOrmModule y ConfigModule.
- `database/database.config.ts` y `database/data-source.ts`: configuración compartida y DataSource del CLI.
- `database/initialize.ts`: aplica el SQL inicial en una transacción y serializa inicializaciones concurrentes.
- `docs/swagger.ts`: configura OpenAPI/UI y el encabezado de identidad.
- `compliance/monitor.service.ts`: adaptador HTTP al mock, contrato de riesgo y timeout.

## Cómo leer la creación de un intercambio

1. Validar clave y buscar una respuesta idempotente ya confirmada.
2. Consultar la cotización propia y hacer una validación inicial.
3. Consultar el mock antes de abrir la transacción. Una llamada de red lenta no debe prolongar un bloqueo monetario.
4. Abrir `DataSource.transaction` y recibir un `EntityManager` ligado a una sola conexión.
5. Tomar bloqueo advisory por usuario/clave y volver a consultar idempotencia: otra solicitud pudo confirmar mientras se consultaba el mock.
6. Usar `pessimistic_write` para bloquear la cotización, comprobar vigencia/estado y bloquear wallets en orden de ID.
7. Validar el saldo actualizado. Esta comprobación bajo bloqueo es la que previene el doble gasto.
8. Crear operación y movimientos según riesgo. El trigger del ledger actualiza los saldos; el servicio no los edita directamente.
9. Consumir cotización si el riesgo fue validado, registrar auditoría y guardar la respuesta idempotente.
10. Confirmar todo, o revertir todo si falla un paso.

Si el mock falla, se registra FAILED con HTTP 503 y sin movimientos. El riesgo desconocido no autoriza una operación. La misma clave devuelve ese resultado original; otra clave permite un nuevo intento con una cotización todavía vigente.

## Revisión de una operación HIGH

El bloqueo de la operación evita dos decisiones simultáneas. Aprobar consume retenido y acredita destino; rechazar devuelve retenido a disponible. Se usan precio, comisión y monto guardados. No se exige una cotización nueva aunque haya vencido durante la revisión.

## Convenciones de mantenimiento

- Escribir comentarios sobre motivos e invariantes; evitar narrar cada instrucción.
- Documentar métodos con efectos transaccionales y decisiones que no son obvias.
- Mantener cantidades como cadenas/Decimal y nunca convertirlas con `Number` o `parseFloat`.
- Dentro de `DataSource.transaction`, obtener repositorios desde `manager.getRepository(Entity)`. No usar repositorios inyectados globales para escrituras transaccionales.
- El ledger comprueba que el manager pertenezca a una transacción activa. Sus inserts disparan el trigger; no guardar una wallet antigua mediante `save`, pues podría sobrescribir un saldo actualizado por el trigger.
- Mantener orden estable de bloqueo, validación de propietario y pruebas de concurrencia al cambiar flujos monetarios.
- Actualizar decorators Swagger, DTOs, README y pruebas si cambia el contrato HTTP.
- Formatear con `npm run format`; comprobar con `npm run format:check`.
- `database/schema.sql` es la fuente del esquema inicial; TypeORM no modifica las tablas automáticamente.

Swagger sigue la [integración oficial de NestJS](https://docs.nestjs.com/openapi/introduction) y su [declaración de seguridad OpenAPI](https://docs.nestjs.com/openapi/security). El esquema `apiKey` solo describe cómo enviar X-User-Id; no convierte este encabezado de prueba en autenticación fuerte.

La integración sigue los patrones de [NestJS y TypeORM](https://docs.nestjs.com/data/typeorm) y las [transacciones de TypeORM](https://typeorm.io/docs/transactions/). `synchronize: false` conserva el SQL explícito como definición del esquema.

`Asset` define el catálogo; `Wallet` define el propietario del contenedor; `WalletAsset` guarda los saldos. Los repositorios monetarios trabajan sobre `WalletAsset` y el ledger referencia `wallet_asset_id`. No guardar saldos con `save/update`: insertar movimientos dentro de la transacción.
