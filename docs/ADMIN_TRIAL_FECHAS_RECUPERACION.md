# Vencimiento de trial y recuperación comercial — 2026-10-11

## Estado y autoridad

Plan aprobado: corregir el rechazo/bloqueo y permitir acortar, extender y vencer
inmediatamente un trial. **Publicado y habilitado en producción el 2026-10-11.**
El usuario autorizó ambas acciones propuestas: la única migración indicada en
una transacción y el recibo fallido del request del incidente. Es una excepción
directa a Lovable, documentada; no habilita otras migraciones ni cambios de datos.
No se cambiaron fechas reales ni precios. El switch comercial se pausó para
publicar y se restauró a true a las 04:53:38 Argentina.

Aplicada: `20261011090000_platform_admin_trial_dates.sql`.
Solo reemplaza `platform_admin_manage_organization`: SECURITY INVOKER,
ejecutable solo por service_role. No cambia tablas/RLS, triggers, DEFINER ni
fechas existentes. La migración anterior aplicada no se editó.
SHA-256: `547a095ce13bc365fe58a50fc3fc370412a26e3bcbb102633affa364db62f05c`.
Aplicación por editor SQL de Supabase a las 04:47:03 Argentina, BEGIN/COMMIT,
lock_timeout 5s y statement_timeout 20s. No se usó db push ni migration up.
Resultado leído tras COMMIT: INVOKER, service_role execute true,
anon/authenticated execute false, nueva acción true y viejo 40001 false.

## Incidente de producción — diagnóstico de solo lectura

Request `8947710e-47e3-47c4-85a9-cfc086e47c29`: se intentó poner
11/10/2026 04:15 Argentina cuando el trial vencía el 25/10/2026 11:12.
El contrato anterior solo extendía. No se guardó: ausencia de auditoría del
request, revisiones y fecha reales intactas.

Los registros mostraron miles de `TRIAL_EXTENSION_NOT_ALLOWED / 40001`
del backend PostgREST PID 1023086, sesión iniciada 07:06:16 UTC. POST Edge 500;
status posterior 200/not_found. A las 07:17:15 UTC: backend idle/ClientRead,
sin transacción, última consulta 07:15:00. No se canceló ni reinició.
La fecha enviada ya había pasado; esa coincidencia no prueba por sí sola
la causa exacta de finalización del proceso.

Supabase documenta el bucle de reintentos de errores custom 40001:
[fuente oficial](https://supabase.com/docs/guides/troubleshooting/high-cpu-and-infinite-transaction-retries-when-using-custom-error-codes-in-rpc-functions-77326b).
Cambiar una función no detiene backends ya en bucle. Revisar actividad y
obtener autoridad puntual antes de terminar uno; no reiniciar todo por defecto.

## Contrato implementado localmente

- `set_trial_end`: timestamp explícito distinto del actual. Fecha pasada:
  expired, sin acceso de prueba; futura: trialing, incluso al reactivar.
  No reescribe el inicio ni crea pagos.
- `extend_trial` conserva semántica anterior para clientes antiguos:
  futuro y posterior al vencimiento actual. La UI nueva usa la acción nueva.
- Elegibilidad sin pagos aprobados, plan pago/manual, referencias MP actuales,
  anteriores o pendientes, checkout ni ítems de precio en vuelo.
- CAS conserva microsegundos, locks suscripción → organización y proyección
  del período si ya reflejaba el trial; períodos nulos siguen nulos.
- Cortesías manuales ya pueden acortarse a una fecha futura mediante
  assign_manual_plan. Vencer ahora es de trial, no de una suscripción paga.

## Rechazos y recuperación

Conflictos de negocio usan PT409, nunca el reintentable 40001.
Un savepoint revierte cambios de negocio y registra un recibo failed con
código permitido/fingerprint/motivo. Advisory lock fuera del savepoint:
rechazo y replay se serializan por request. Sin contraseña ni payload auditado.
Replay idéntico fallido sigue fallido sin duplicar auditoría; otro payload,
actor, objetivo o acción con la misma clave se rechaza. Errores inesperados
permanecen inciertos; no se inventa un recibo definitivo.

La RPC fija response.status a 400/404/409 y devuelve message con el código
permitido: mantiene un rechazo HTTP incluso con la Edge anterior durante
la publicación, sin revertir el recibo auditado. Es un override de respuesta,
no una excepción SQL: [transacciones PostgREST](https://docs.postgrest.org/en/v14/references/transactions.html).
SQL local verifica el setting y su aislamiento entre transacciones; no sustituye
una prueba HTTP real. El endpoint traduce el rechazo a 400/404/409. Status devuelve
completed | failed | not_found, filtrando actor/organización/acciones, sin
exponer metadata ni asumir que cualquier fila auditada es éxito. Funciona
con el switch apagado. El frontend limpia el marcador solo ante resultado
terminal, refresca y permite una operación nueva; nunca reenvía automáticamente.
Not_found/red/5xx conservan el marcador. Rechazo recibido rota el request ID.

El request del incidente se reconcilió con autorización puntual a las 04:49:23
Argentina. Se verificaron actor de plataforma confirmado/no bloqueado, ausencia
de auditoría/proceso comercial activo, fechas/revisiones intactas y guardas MP.
Se insertó solo el recibo failed `aa1c39f0-2d4a-470f-9913-94ab0bb7d1bc`, código
TRIAL_EXTENSION_NOT_ALLOWED, marcado reconciled. Sin cambios de estado auditados
ni escritura en organizaciones, suscripciones, planes, pagos o Auth.
El timestamp es el de reconciliación, no una ejecución original inventada.
Script puntual con abortos: [ADMIN_TRIAL_RECONCILIACION_20261011.sql](ADMIN_TRIAL_RECONCILIACION_20261011.sql),
fuera de migrations y no reutilizable como RPC. El fingerprint especial impide
que se reproduzca la escritura original con la misma clave.

## Formulario y evidencia

DrawerForm, Inter/navy, DatePicker/TimePicker conservados. Capability nueva
deshabilita el botón si backend antiguo. Fecha actual → nueva y zona local;
Vencer ahora solo prepara campos. Checkbox explicita pérdida de acceso y
se invalida al cambiar fecha/hora, plan o acceso indefinido. Motivo y contraseña
obligatorios; error definitivo inline. Impeccable/harden y UI/UX Pro Max
guiaron consecuencias, confirmación y recuperación, no un rediseño.

- 106 Vitest / 21 archivos; 24 Deno y check de query/organization correctos.
- 18 integraciones SQL/WASM sintéticas, migración original + candidata en
  transacciones locales: grants/RLS, rollback, CAS, replay, fechas y guardas MP.
- Build exitoso; lint focal sin errores, tres warnings Fast Refresh (incluye harness QA).
  TypeScript global conserva cinco errores previos fuera del cambio.
- QA local sin APIs: 1440×900, 390×844, 768×1024; contraseña/confirmación
  alcanzables por scroll en mobile y footer fijo.
  Capturas trial-dates-*.jpg en .impeccable/review/admin-commercial, excluidas
  localmente de Git. Datos sintéticos, sin credenciales.

Estas pruebas locales no certifican concurrencia multi-conexión ni una nueva
mutación HTTP real de fechas. No se venció ni extendió un trial real para QA.

## Evidencia productiva de publicación y recuperación

- Supabase: se desplegaron solo platform-admin-organization y platform-admin-query
  con --use-api y JWT obligatorio. Tras reactivar el switch: organization v5,
  query v8, ACTIVE. Los secretos globales incrementan versiones de otras
  funciones: checkout/precios conservaron digest de código y updated_at;
  no se redeplegaron ni se tocó su switch.
- POST sin JWT: 401 en ambos endpoints; JWT inválido: 401 en organization.
  OPTIONS: 204, origen exacto www.vittro.com.ar y header x-request-id permitido.
- Frontend: avance normal de production/main de 6ba4c795 a
  `a2d301da042a9174af6980371a4d578afc0d5b7e`, sin push forzado ni traer origin.
  Vercel confirmó Ready / Production / Current, dominio www.vittro.com.ar,
  deployment `AM4ucAmrCipsJPnwVQ4YpKbQt5BT`, build de 21s.
- Sesión Admin real: marcador antiguo conservado al recargar; Consultar resultado
  eliminó el bloqueo leyendo failed, incluso con el switch apagado. No se
  reenvió el intento. Historial mostró el rechazo y la edición previa de contacto.
- Tras reactivar y refrescar: tres acciones habilitadas, botón Cambiar vencimiento
  del trial. Vencer ahora preparó una fecha pasada, mostró pérdida de acceso y
  checkbox sin marcar. Se canceló el borrador sin guardar ni enviar una mutación.
- Datos preservados: trialing hasta 25/10/2026 11:12:39.02 Argentina;
  revisiones org 2026-10-10T16:54:49.00842Z/sub 2026-10-10T14:13:45.64908Z.
  Básico ARS 1/v3, Profesional 30.000/v2 y Premium 50.000/v2.
- Capturas reales locales trial-production-{migration,vercel,recovered,form}.png
  en .impeccable/review/admin-commercial; excluidas de Git. No se publican
  capturas autenticadas ni credenciales. El formulario fue cancelado tras QA.

Límites: no hubo una nueva escritura autenticada de fechas, una prueba de
rechazo RPC vía PostgREST HTTP ni concurrencia real. Solo lectura, recuperación
del recibo autorizado y preparación/cancelación del formulario en producción.
El cambio efectivo de vencimiento requiere una fecha elegida y confirmación
del usuario. La migración aplicada se conserva, incluido un aviso de línea
vacía final de git diff --check al incorporarla; sin efecto SQL y sin reeditarla.

## Procedimiento aplicado / recuperación ante incidentes

1. Revisar diff/hash y estado productivo; mantener alcance exacto. Tras autoridad
   de publicación, apagar temporalmente PLATFORM_ADMIN_ORG_MUTATIONS_ENABLED
   durante el despliegue para dejar el panel comercial en lectura. No apagar
   acceso tenant, checkout ni mutaciones de precios; no se tocó este switch localmente.
2. Aplicar solo candidata en BEGIN/COMMIT; verificar INVOKER/grants/definición
   sin mutar una barbería.
3. Publicar platform-admin-organization y platform-admin-query, JWT obligatorio.
   No publicar checkout/precios/webhooks.
4. Publicar frontend por remoto de producción BarberApp; no traer merge roto
   del otro remoto. Mantener Básico ARS 1 y trial real.
5. Reconciliar request viejo solo con autorización/evidencia renovada.
6. QA autenticado de lectura/status/historial y restaurar el switch comercial
   solo tras verificar las versiones desplegadas. Una prueba real de vencimiento
   requiere elegir fecha y confirmar por el usuario.
7. Ante incidente, apagar solo switch comercial. No borrar datos ni revertir
   automáticamente acciones confirmadas.
