# Programa de aliados — evidencia de producción

Fecha: 2026-10-14. Proyecto Supabase: `azqpyfoobpovqosbayvz` (Vittro).
Estado inicial de este registro: backend publicado y probado; alta cerrada
por readiness de DB hasta publicación del frontend. Instagram deshabilitado.

## Autoridad y alcance

El usuario respondió «podemos ir a produccion directamente» a la consulta sobre
Lovable o excepción puntual SQL. Autoriza este rollout de DB/RLS, backend y
frontend; la excepción se documenta aquí conforme AGENTS.md. No cambia la regla
general de Lovable ni autoriza otras migraciones o intervenciones financieras.

Se reportó antes de aplicar la adaptación de `handle_new_user`, SECURITY DEFINER
existente: identidad externa con perfil sin barbería/trial, y atribución validada
al final del alta tenant. El cuerpo productivo original era `md5(prosrc)=
db13ead169c47bb2052cda933af11fef`; la migración aborta si no coincide. Se conservan
las ramas originales de Admin, invitaciones, sucursales y aprovisionamiento.

## Migraciones y aislamiento

Aplicadas en una transacción dirigida, con lock timeout y guard de reaplicación:

- `20261014130000_partner_program.sql`: 19 tablas, RPC y motor transaccional.
- `20261014130100_partner_auth.sql`: Auth y atribución en signup.
- `20261014130200_partner_checkout_storage.sql`: wrapper del finalizador de
  catálogo existente y Storage privado/restrictivo para comprobantes.

La prueba real detectó que service_role tiene SELECT, sin UPDATE, sobre Auth.
Se corrigió mediante `20261014130300_partner_auth_lock.sql`: advisory lock por
identidad al adherir, sin ampliar permisos de Auth. La prueba volvió a pasar.
Las cuatro versiones están registradas en schema_migrations con su fuente.
No se usó db push ni se reparó/reaplicó el historial anterior con timestamps
locales distintos. Generadores y pruebas en `supabase/tests/`.

Inspección productiva: 19/19 tablas con RLS; cero tablas del programa legibles
por anon/authenticated; cero funciones propias nuevas DEFINER. Las funciones
solo ejecutan con service_role y revalidan actor/tenant explícitamente.
Las filas financieras tenant llevan FK compuesta organización/sucursal inicial.
Identidad, convenios y agregados de plataforma no fabrican un tenant.

## Runtime y recuperación

Desplegadas únicamente estas funciones, todas ACTIVE:

| Función | Versión observada | verify_jwt |
| --- | ---: | --- |
| partner-program | 1 | false, validación explícita de sesión/actor |
| partner-program-worker | 1 | false, secreto servidor o HMAC reciente |
| partner-instagram-callback | 1 | false, nonce de un uso y gate de Instagram |
| subscription-create-checkout | 26 | true |
| subscription-mp-webhook | 25 | false, firma MP existente |

APP_ORIGIN es `https://www.vittro.com.ar`. Secrets nuevos aleatorios: worker,
rate limit y AES-GCM; no se guardan en Git ni se publican en respuestas. Se
configuraron los switches de programa/billing, pero DB readiness mantiene el
alta cerrada durante el rollout. Instagram ENABLED/VERIFIED permanecen false.

Se reportó y habilitó la extensión oficial pg_net, que tiene funciones internas
privilegiadas. Job `partner-program-worker`, cada minuto: consulta Vault y firma
timestamp/nonce con HMAC-SHA256. La cola no recibe el secreto permanente.
El worker acepta firmas durante 120 segundos; leases, unicidad y CAS impiden
que invocaciones repetidas dupliquen una comisión o liquidación. Invocación
autenticada: HTTP 200, processed=0, failed=0. Cron SQL: succeeded.

Bucket `partner-payout-receipts` privado, 10 MiB, PDF/PNG/JPEG. Políticas
restrictivas cubren políticas permisivas anteriores y prohíben sobrescritura/
eliminación desde cliente. Solo Admin ve comprobantes y datos bancarios completos.

Auth allowlist actualizado mediante PATCH de **uri_allow_list solamente**,
conservando las entradas previas de Lovable y reset-password. Añadidos
`https://www.vittro.com.ar/aliados/panel` y su variante `?mode=reset`. site_url
sigue en el dominio productivo; sin config push de Auth global.

## Evidencia de validación y límites

- 200 Vitest / 28 archivos, 32 Deno, build Vite y lint focal aprobados.
- 26 pruebas SQL reales en PGlite: unicidad, scope, CAS, cotización, comisiones,
  reversión parcial/completa antes/después de liquidar, lotes, leases, OAuth,
  Storage frente a políticas permisivas. Auth sintético replica ausencia de UPDATE.
- `partners-production-rollback.sql` pasó en el esquema real: creador sin tenant,
  código sin distinción de mayúsculas, registro tenant con trial y atribución en
  sucursal inicial, cotización introductoria, resumen agregado, aislamiento y ACL.
  ROLLBACK verificado: cero usuarios fixture, flags de DB false.
- Nueve probes productivos: status cerrado 200; panel/Admin sin sesión 401;
  origin no confiable 403; worker sin secreto/incorrecto 401; checkout sin JWT
  401; código con programa cerrado 503; CORS permite origen productivo exacto.
- QA visual sintético: nueve escenarios a 390/768/1440px, sin errores/overflow,
  con importes grandes y drawers; `.impeccable/review/partners/report.json`.

No se generaron cargos, devoluciones, transferencias ni emails a terceros.
Las pruebas de dinero son sintéticas; no acreditan recepción real de primer/
segundo cobro, devolución/contracargo o transferencia bancaria. Quedan esas
comprobaciones y concurrencia ampliada con conexiones independientes. Instagram
solo se habilita después de una cuenta profesional externa y permisos reales.
tsc app mantiene cinco errores preexistentes abortSignal/readRetry; build pasa.

## Publicación y habilitación

Pendiente al cerrar la etapa backend: publicar primero en origin, comprobar SHA,
sincronizar el fork existente production por avance normal y verificar Vercel
Ready / Production / Current del mismo commit. Abrir DB readiness después.

Para cerrar altas: PARTNER_PROGRAM_ENABLED=false y enrollment_enabled=false.
Conservar billing/worker activos para liquidar obligaciones ya atribuidas.
PARTNER_BILLING_ENABLED=false es apagado de emergencia del motor; también
detiene sus trabajos y exige reconciliar obligaciones al reactivarlo.
