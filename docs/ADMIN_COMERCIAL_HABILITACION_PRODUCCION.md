# Gestión comercial — habilitación en producción

Fecha: 2026-10-10. **Edición de datos/contacto, acceso manual y extensión de
trial elegible habilitados en producción**. Suspensión, gestión de Auth/roles
y modificación de contratos Mercado Pago siguen fuera de esta entrega.

## Autorización y alcance

El usuario pidió activar la gestión comercial y conservar Básico a ARS 1 para
una prueba. Autorizó la barbería vinculada a su cuenta de prueba; la búsqueda
dirigida identificó `Barberia de ejemplo`, organización
`60c0dedd-2bf6-4d3b-b989-2387a7dece49`. Después eligió explícitamente mantener
su trial para probar la compra a ARS 1, no convertirlo en una cortesía manual.

No se aplicaron migraciones, cambios RLS, cambios a funciones SECURITY DEFINER,
credenciales ni contratos MP. El frontend/backend publicados no se modificaron.
La autorización de esta activación no habilita futuras migraciones directas.

## Preflight productivo de solo lectura

- Query v4 y organization v1: ACTIVE, `verify_jwt=true`.
- RPC comercial SECURITY INVOKER; EXECUTE solo service_role, no anon/authenticated.
- Contactos con RLS activa y cero policies tenant.
- Definiciones reales de `get_organization_subscription_access`,
  `sync_organization_subscription_projection` y `touch_subscription_updated_at`
  verificadas. El acceso usa fechas efectivas; la proyección copia plan y
  vencimiento. Se leyeron, no se reemplazaron ni se impersonó a un tenant.
- Baseline: 34 organizaciones, 34 suscripciones, cero pagos, cero contactos
  comerciales y cero auditorías de las tres acciones nuevas; cero ítems de
  precio pending/processing o con compensación pendiente.
- Cuenta de prueba: trial Premium hasta `2026-10-25T14:12:39.02Z`, sin referencias
  MP, plan contratado ni pagos aprobados. Revisión de suscripción
  `2026-10-10T14:13:45.64908Z`; nombre/slug originales conservados.
- Catálogo: Básico ARS 1/v3, Profesional ARS 30.000/v2, Premium ARS 50.000/v2.

## Habilitación y prueba real

Se cambió únicamente el secret `PLATFORM_ADMIN_ORG_MUTATIONS_ENABLED` a `true`
mediante CLI autenticada. Timestamp confirmado: **2026-10-10T16:54:01.411Z**
(13:54 Argentina). Se contrastó el digest del secret con SHA-256 de `true`,
sin extraer credenciales. No se cambió el switch de precios ni se redeplegaron
funciones, checkout o webhooks.

La ficha autenticada mostró los tres botones habilitados. Se preparó la edición
del contacto de la barbería de prueba y el usuario ingresó personalmente su
contraseña y confirmó el formulario, según su respuesta explícita. Quedó una
única edición de email comercial; teléfono/dirección, nombre, slug y Auth no se
modificaron. La contraseña no se copió a archivos, documentación ni consola.

- Request ID: `9a37dc63-9af0-4134-8dc4-f7e849144a35`.
- Acción: `organization.details_updated`, resultado `succeeded`.
- Commit de la acción: **2026-10-10T16:54:49.00842Z** (13:54 Argentina).
- Historial mostró una sola entrada y la ficha recargada conservó el contacto.
- Pruebas posteriores con confirmación deliberadamente incorrecta fueron
  rechazadas; se observó «La contraseña no coincide. Ingresala nuevamente.».
  La contraseña se limpió del formulario, la sesión siguió abierta y no se
  añadió otra auditoría comercial.
- POST sin JWT siguió devolviendo 401 `UNAUTHORIZED_NO_AUTH_HEADER` después de
  habilitar: el switch no permite acceso sin autenticación.

La lectura SQL independiente posterior confirmó: contacto guardado, nombre y
slug preservados, trial intacto, revisión de suscripción intacta, proyección
coincidente, **una auditoría para el request y una auditoría comercial total de
esa barbería**, un contacto comercial total, cero pagos y cero ítems de precio
en vuelo. Básico seguía a ARS 1/v3. Ninguna llamada a Mercado Pago en esta operación.

## Verificación local repetida

- Vitest completo: **98 pruebas / 21 archivos aprobados**.
- Deno: **22 pruebas aprobadas** (6 autorización Admin y 16 comerciales).
- SQL sintético local: **14 integraciones aprobadas**.
- `git diff --check` sin errores antes de documentar; únicamente documentación
  modificada para registrar la activación, no código visual ni lógico.

Capturas autenticadas locales, excluidas de Git:
`.impeccable/review/admin-commercial/production-commercial-enabled.jpg` y
`production-commercial-reauth.jpg`. No publicar estas capturas con datos de
contacto en repositorios. La ficha se dejó abierta como resultado verificable.

## Límites de esta evidencia

La escritura real verificada es contacto. Acceso manual y extensión de trial
están habilitados y cubiertos por los contratos y SQL locales; **no se ejecutaron
sobre la cuenta de prueba**, porque el usuario eligió conservar su trial.
No se certifica aquí concurrencia multi-conexión productiva, recuperación de una
escritura interrumpida, denegación autenticada tenant ni convivencia/logout de
dos sesiones reales. Estas pruebas ampliadas siguen pendientes; tampoco se
probó una renovación MP, webhook firmado o un cobro efectivo de ARS 1.

El importe histórico configurado del trial no es un pago ni el precio actual
del catálogo. La prueba de contratación/cobro debe hacerse desde la sesión
tenant y completarla el usuario en Mercado Pago; no usar «Asignar acceso
manual» como sustituto de comprar Básico.

Ante una anomalía, apagar solo `PLATFORM_ADMIN_ORG_MUTATIONS_ENABLED=false`.
Esto detiene nuevas escrituras comerciales, conserva status/lectura y no
revierte acciones confirmadas ni cambia precios. Conservar el request ID y la
auditoría; no borrar registros para destrabar una operación.
