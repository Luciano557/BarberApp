# Gestión comercial — evidencia de migración en producción

Fecha: 2026-10-10. Proyecto: `azqpyfoobpovqosbayvz` (Vittro, base primaria).

## Autorización y alcance

El usuario autorizó explícitamente aplicar directamente **únicamente**
`20261010130000_platform_admin_commercial.sql`, en una sola transacción,
sin ejecutar otras migraciones. Es una excepción puntual a DB/RLS por Lovable;
no autoriza migraciones adicionales, despliegues ni habilitación comercial.

Se usó SQL Editor en la sesión del usuario, sin extraer credenciales. No había
backup disponible. La migración es aditiva: tabla privada y RPC, sin ejecutar
mutaciones sobre datos existentes ni sustituir funciones `SECURITY DEFINER`.

Archivo ejecutado:
`supabase/migrations/20261010130000_platform_admin_commercial.sql`.
SHA-256 del archivo local sin modificar:
`a03c353c22dc0286f9af58f585d94601bae3f2dd55418b38ff92b4e638023fad`.

## Ejecución

- Preflight de solo lectura: tabla/RPC nuevas ausentes, ninguna columna requerida
  faltante, roles/grants compatibles y proyección existente confirmada.
- Contenido íntegro del archivo dentro de `BEGIN` / `COMMIT`, con
  `lock_timeout=5s`, `statement_timeout=30s` y lock transaccional de esta versión.
- Guardas antes del commit verificaron RLS, cero policies tenant, grants y cuerpo
  de la RPC. El editor se contrastó con el SQL preparado mediante copia completa;
  la comparación de integridad normaliza únicamente CRLF/LF.
- Se insertó **solo esta versión** en `supabase_migrations.schema_migrations`
  dentro de la misma transacción, con nombre `platform_admin_commercial` y
  contenido del archivo. No se reparó ni ejecutó ninguna otra versión del historial.
- `COMMIT` confirmado: **2026-10-10 13:08:48.028921 UTC**
  (**10:08:48 Argentina**). SQL Editor devolvió RLS `true`, policies `0`,
  RPC `INVOKER`; el dashboard mostró esta versión como última migración.

## Lectura independiente posterior

Consulta nueva de solo lectura a las **13:10:32.207228 UTC**:

| Comprobación | Resultado |
|---|---|
| Versión / nombre | `20261010130000` / `platform_admin_commercial` |
| Contenido del historial y cuerpo RPC | Coinciden con el archivo ejecutado, normalizando CRLF/LF |
| Contactos | RLS activa, cero policies, cero filas |
| Privilegios contactos para `anon` / `authenticated` | Ninguno |
| Contactos para `service_role` | SELECT, INSERT, UPDATE; sin DELETE/TRUNCATE/REFERENCES/TRIGGER |
| RPC | `SECURITY INVOKER`, `search_path=public` |
| EXECUTE para PUBLIC / `anon` / `authenticated` | Revocado |
| EXECUTE para `service_role` | Concedido |

Los conteos anteriores y posteriores coinciden: **34 organizaciones,
34 suscripciones, 0 pagos, 16 auditorías, 3 lotes y 30 ítems**. Son conteos,
no una comparación hash de cada fila. No se llamó a la RPC comercial en producción.
Catálogo intacto: Básico ARS 20.000, Profesional ARS 30.000, Premium ARS 50.000,
todos versión 2. No hubo llamadas a Mercado Pago ni cambios Auth.

Captura real de Supabase:
`../.impeccable/review/admin-commercial/production-migration.jpg`.
Muestra parte del resultado independiente (RPC, catálogo e historial);
la tabla anterior registra también los campos leídos fuera del encuadre.

## Pendientes y límites

La **base está migrada**, pero el endpoint comercial nuevo y el frontend siguen
sin desplegar. No se modificaron secrets/kill switches ni se habilitaron
escrituras. Falta despliegue inicialmente en lectura, QA autenticado, prueba
comercial acordada y concurrencia real antes de habilitar. Suspensión sigue
diferida; la entrega de webhooks no se valida con esta migración.

Seguir `ADMIN_COMERCIAL_ACTIVACION.md` desde el paso 2. No reejecutar esta
migración ni usar un `supabase db push` general para este rollout.
