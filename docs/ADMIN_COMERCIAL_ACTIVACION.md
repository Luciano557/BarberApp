# Activación de gestión comercial por barbería

Fecha: 2026-10-10. **Migración, backend y frontend publicados en producción;
gestión comercial en modo lectura, escrituras deshabilitadas**.
Esto amplía Admin con ficha, contacto privado, acceso manual y trial. No incluye
suspensión, credenciales/roles tenant, catálogo ni modificación de contratos MP.

## 1. Migración — completada con excepción directa autorizada

Archivo: `supabase/migrations/20261010130000_platform_admin_commercial.sql`.
Se aplicó únicamente este archivo en Supabase `azqpyfoobpovqosbayvz` con una
nueva autorización explícita del usuario, en una sola transacción. Commit:
2026-10-10 13:08:48 UTC (10:08:48 Argentina). Se registró únicamente esta versión
en el historial dentro de la misma transacción; ninguna otra migración ejecutada.

RLS activa, cero policies tenant, SELECT/INSERT/UPDATE solo para service_role
y RPC SECURITY INVOKER con EXECUTE revocado a PUBLIC/anon/authenticated fueron
verificados antes del commit y en una lectura independiente posterior.
Sin mutaciones de barberías/suscripciones/pagos ni cambios a DEFINER existentes.
Evidencia: [ADMIN_COMERCIAL_MIGRACION_PRODUCCION.md](ADMIN_COMERCIAL_MIGRACION_PRODUCCION.md).

**No reejecutar este paso ni usar `supabase db push` general.** La excepción
cubre solo esta migración; DB/RLS futuras siguen por Lovable o necesitan otra
autorización puntual. Continuar desde el paso 2; secrets y despliegues no se
modificaron en esta operación.

## 2. Mantener el kill switch apagado y desplegar backend

**Completado:** secret configurado en `false`; query v4 y organization v1 ACTIVE,
con JWT obligatorio. No repetir despliegue si no hay cambios nuevos. Evidencia:
[ADMIN_COMERCIAL_DESPLIEGUE_PRODUCCION.md](ADMIN_COMERCIAL_DESPLIEGUE_PRODUCCION.md).

Configurar en secrets de Supabase, nunca `VITE_*`:

```text
PLATFORM_ADMIN_ORG_MUTATIONS_ENABLED=false
```

Desplegar solo los endpoints modificados:

```powershell
npx supabase functions deploy platform-admin-query --project-ref azqpyfoobpovqosbayvz
npx supabase functions deploy platform-admin-organization --project-ref azqpyfoobpovqosbayvz
```

Usar la autenticación normal de CLI/Dashboard; no pegar service_role, tokens ni
contraseñas en la consola, repositorio o chat. Conservar `verify_jwt=true` de
`supabase/config.toml`. Los dos endpoints reutilizan el helper de plataforma y
los orígenes existentes de Admin. No redeplegar checkout/webhooks por este cambio.

Comprobar 401 sin JWT y 403 con usuario tenant/claim inválido; `status` y consultas
autorizadas funcionan con el switch apagado, escrituras devuelven 503 específico.

## 3. Publicar frontend inicialmente en lectura

**Publicado y comprobado con sesión Admin real:** Vercel Ready/Production/Current,
commit `17450d70`, directorio y fichas manual/trial/vencido, contacto nulo,
historial y QA 390/768/1024/1440. Las tres acciones comerciales están deshabilitadas.
Los casos de error, contrato MP y convivencia tenant siguen teniendo evidencia
local, no una certificación autenticada productiva de toda la matriz.

Revisar el diff/PR, pasar checks y usar el flujo normal GitHub/Vercel. El build
incorpora `/admin/barberias/:organizationId`; se abre desde el nombre en tabla
y cards. No hay nuevas variables frontend ni una contraseña en el bundle.
No publicar el frontend antes del backend/migración: la ficha requiere el DTO y
la tabla nueva. El preview `qa/admin-commercial.html` solo funciona con Vite dev;
no es una entrada del build ni una ruta autenticada de producción.

Validar con una sesión Admin real: navegación/ficha, contacto nulo, trial,
manual temporal/indefinido, MP autorizado/checkout, historial vacío/error,
refetch conservando datos. Verificar 390, 768/1024 y 1440 px y convivencia con
la sesión tenant. El QA local sintético no demuestra estas condiciones reales.

## 4. Habilitación controlada y prueba acordada

Antes de habilitar, elegir una barbería de prueba autorizada y guardar sus
valores/revisiones anteriores; acordar qué cambio comercial se realizará.
No usar un cliente pago real para probar una cortesía. Verificar además las
definiciones reales del acceso tenant y la proyección existentes, y probar
concurrencia con dos sesiones/conexiones reales antes de un rollout general.

Solo después de estas verificaciones, habilitar en secrets de servidor:

```text
PLATFORM_ADMIN_ORG_MUTATIONS_ENABLED=true
```

El switch habilita las tres acciones comerciales de esta fase, no suspensión.
Probar edición/contacto con motivo y contraseña, guardar el request ID y
corroborar una sola auditoría. Luego asignación manual con fin explícito y trial
sin pagos previos, si la organización elegida corresponde a esos casos.
Verificar proyección/acceso efectivo y que catálogo, pagos y Mercado Pago no
cambiaron. Los contratos/refs/checkouts MP o compensaciones pendientes deben
rechazar el cambio de acceso, no cancelarse automáticamente.

Con contraseña de confirmación incorrecta, la sesión Admin sigue abierta. Una
denegación auténtica de autorización cierra únicamente el cliente Admin.

## 5. Recuperación y apagado

Ante error/transacción incierta, conservar el request ID. La ficha guarda solo
ID/acción en `sessionStorage`, separado por actor y barbería; no el formulario
ni contraseña. Consultar resultado busca auditoría por org + request ID y evita
repetir automáticamente. `not_found` no prueba que una petición concurrente ya
terminó: no desbloquear/recrear el cambio sin reconciliar la solicitud original.
Si después de una recarga persiste sin confirmación, un operador debe comprobar
en servidor que no quedó ejecución/commit antes de limpiar ese marcador local;
no borrar registros de auditoría para destrabarlo.

Apagar `PLATFORM_ADMIN_ORG_MUTATIONS_ENABLED=false` ante anomalías. No revierte
cambios ya confirmados ni modifica el switch de precios. Conservar auditoría y
datos, y resolver cada estado por su ID. Suspensión efectiva sigue fuera de este
rollout: requiere auditoría y autorización específica si cambia un DEFINER.

## Evidencia local y pendientes

- 36 pruebas Vitest: contratos, guards, formularios, recuperación y caché sin
  contraseña; 22 pruebas Deno (6 Admin + 16 comerciales); 14 integraciones
  PostgreSQL/WASM sintéticas.
- `deno check`, lint focal sin errores, build y `git diff --check` exitosos.
  TypeScript global conserva cinco errores previos no relacionados; dos warnings
  Fast Refresh en helpers exportados desde componentes no bloquean el build.
- Capturas locales en `.impeccable/review/admin-commercial/`: 390, 768, 1024,
  1280 (ancho del navegador), 1440; manual, trial vencido, bloqueo MP, lectura y
  errores inline. Datos sintéticos, ninguna escritura a producción.
- Revisión independiente Impeccable cerrada con `ship` sobre sus tres
  correcciones: selectores canónicos de fecha/hora, explicaciones de 14px y
  títulos de cards de 18px. Las once recapturas fueron validadas; no es una
  certificación del rollout ni de la sesión/backend productivos.
- Migración productiva confirmada con autorización puntual y evidencia separada;
  no reemplaza las pruebas de API/frontend ni habilita escrituras.
- Backend/frontend publicados y QA de lectura real documentados en
  `ADMIN_COMERCIAL_DESPLIEGUE_PRODUCCION.md`; no habilita escrituras.
- Pendientes: prueba comercial acordada, concurrencia multi-conexión,
  recuperación/denegación/convivencia autenticadas y matriz de webhooks.
  La verificación sintética no reemplaza esas pruebas.
