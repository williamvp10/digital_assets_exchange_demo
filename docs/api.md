# Contrato HTTP

Swagger interactivo: http://localhost:3100/docs. OpenAPI: http://localhost:3100/docs-json. En Authorize ingresar la identidad de prueba; para POST /exchanges también completar Idempotency-Key.

URL base: `http://localhost:3100`. Todas las rutas requieren `X-User-Id`. Cantidades monetarias se envían y retornan como cadenas. UUIDs en identificadores. La respuesta de error NestJS incluye `statusCode`, `message` y `error`.

| Método | Ruta | Rol | Solicitud / respuesta |
|---|---|---|---|
| GET | /wallets | USER | Array de saldos con id (wallet_assets), wallet_id (contenedor), user_id, asset, available, held, total |
| GET | /wallets/:id/movements | USER propietario | Array de movimientos confirmados; :id es wallet_assets.id y la respuesta usa wallet_asset_id |
| POST | /quotes | USER | `{"amount":"2500"}` → 201 cotización con id, amount, price, fee, received, expires_at, status |
| POST | /exchanges | USER | `{"quoteId":"uuid"}` + `Idempotency-Key` → 201 operación; 503 operación FAILED |
| GET | /exchanges | USER | Operaciones propias |
| GET | /exchanges/:id | USER propietario | Operación con events de trazabilidad |
| GET | /compliance/exchanges/pending | COMPLIANCE | Operaciones HIGH pendientes con events |
| GET | /compliance/exchanges/:id | COMPLIANCE | Detalle y trazabilidad de decisiones |
| PATCH | /compliance/exchanges/:id/approve | COMPLIANCE | Sin body → 200 operación COMPLETED |
| PATCH | /compliance/exchanges/:id/reject | COMPLIANCE | Sin body → 200 operación REJECTED |

401: identidad ausente/desconocida. 403: rol incorrecto. 404: recurso inexistente o ajeno. 400: saldo insuficiente, cotización vencida, monto/UUID/body inválido o clave ausente. 409: cotización consumida, decisión repetida o clave con distinto contenido. 503: monitoreo no disponible; body contiene operación FAILED y su ID para trazabilidad.

Los movimientos incluyen tipo, referencia/operación, deltas, fecha, estado y saldo disponible/retenido antes/después; total previo/posterior se obtiene sumando ambos componentes.

Riesgo HIGH conserva monto, precio y comisión de la cotización. Repetir la creación devuelve la respuesta original; para estado actualizado consultar GET /exchanges/:id.
