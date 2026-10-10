# Decisiones de arquitectura y criterio — Vittro

Registro del "por qué", no del "qué". Para el estado actual de cada módulo,
ver `ESTADO_ACTUAL.md`. Para la especificación normativa vigente del sistema
visual, ver `DESIGN.md` — este archivo no repite esa especificación, solo el
contexto y el razonamiento detrás de cada decisión.

<<<<<<< HEAD
## Excepción directa acotada para la migración comercial — 2026-10-10

Al no disponer del propietario de Lovable, el usuario autorizó expresamente
solo `20261010130000_platform_admin_commercial.sql` en producción y una única
transacción. Se aplicó el archivo íntegro con guardas y se registró esa versión
en el historial dentro del mismo commit; no se ejecutaron ni repararon otras
migraciones. RLS/grants/RPC se comprobaron por lectura independiente posterior.
La excepción no cambia la regla general de DB/RLS por Lovable ni autoriza
desplegar o habilitar escrituras. Evidencia y límites:
`docs/ADMIN_COMERCIAL_MIGRACION_PRODUCCION.md`.

## Gestión comercial separada de facturación y de Auth — 2026-10-10

Plan aprobado para editar barbería/contacto, otorgar acceso manual y extender
trial. El email comercial es privado e independiente del login; cambiar datos
no cambia slug, roles ni credenciales. El acceso manual no implica un débito ni
autoriza cancelar un contrato Mercado Pago. Cualquier vínculo/pending/fence de
proveedor requiere reconciliación explícita antes de cambiar acceso.

Una RPC nueva `SECURITY INVOKER`, restringida a `service_role`, guarda cambio y
auditoría en una transacción; CAS conserva microsegundos y un request ID estable
evita repetir efectos. Reautenticación efímera y kill switch comercial apagado
son independientes del editor de precios. Se validó en PostgreSQL local
sintético, no producción. La aprobación del build no concede una excepción para
aplicar DB fuera de Lovable. Suspensión queda separada hasta demostrar enforcement
servidor; no se presenta un switch visual como bloqueo efectivo.

La ficha amplía la superficie vigente sin reemplazar su identidad. Separar
«fuente de acceso», «plan efectivo» y «facturación» evita que una cortesía se
interprete como suscripción cobrada. Los vencimientos se eligen con los pickers
canónicos, se interpretan en la zona local y se convierten a UTC al enviar;
no se redondean minutos. Ante un resultado ambiguo se conserva solo ID/acción,
no contraseña ni formulario, y se bloquea repetir hasta reconciliar el ID.
Un `not_found` no acredita que la primera transacción ya terminó. Por eso la
recuperación exige lectura/auditoría del servidor, no un botón de reenvío ciego.

## Un checkout pendiente no define el contrato vigente — 2026-10-10

BarberMalza conservaba una asignación manual de Básico sin vencimiento, pero su
proveedor local era Mercado Pago y apuntaba a un checkout pendiente antiguo de
Premium. El proveedor verificó cuenta/aplicación/referencia y cero facturas;
no había evidencia de una renovación autorizada ni de pagos locales. Convertir
ese vínculo en una renovación habría mezclado intenciones comerciales distintas.

Con autorización explícita se canceló únicamente el checkout antiguo y se
reclasificó la suscripción como manual, preservando acceso, plan, vencimiento y
snapshots históricos. La excepción directa de DB se ejecutó en una transacción
con guards y auditoría, sin migraciones ni funciones nuevas. El lote se cerró
mediante las RPC canónicas, no forzando su estado: completado significa todos
los objetivos terminales, no todos cobrados/actualizados. Los 26 faltantes de
preapproval permanecen visibles y el caso manual queda excluido.

La siguiente fase de Admin debe mostrar separadamente acceso manual/trial,
contrato con Mercado Pago y evidencia de pagos. Una asignación manual no debe
cancelar o modificar automáticamente un contrato autorizado. Tampoco basta
cambiar `organizations.is_active` para prometer suspensión efectiva: hay que
verificar enforcement server-side y sesiones existentes. El alcance confirmado
por el usuario es barbería/contacto, no gestión de identidades de Supabase Auth.

Evidencia operativa y pendientes de facturación: `docs/MODULOS/admin.md`.

## Datos ficticios independientes para grabar Finanzas — 2026-10-01

Los ejemplos se crean desde una fecha y una sucursal sintética, sin transformar importes o nombres reales. El modo mantiene los contextos reales para autorización, pero suspende lecturas operativas y protege escrituras, incluidas las automáticas al cargar Sueldos/Gastos. `sessionStorage` lo limita a la pestaña y lo vincula a la identidad tenant para evitar arrastrarlo a otra cuenta. Las operaciones reales en curso deben terminar antes de activar. La navegación fuera de Finanzas requiere salida explícita; la URL queda sin cambios porque la grabación acordada cubre solo el contenido de la app.

Se usa una presentación ficticia para la barra lateral, sin alterar la sucursal operativa: modificar el contexto real habría cambiado el alcance de consultas y permisos al volver al uso normal. Al cambiar la fuente se remontan los paneles para impedir que formularios o detalles anteriores reaparezcan. La confirmación vive en el árbol tenant para cubrir también un bloqueo de suscripción sobrevenido, manteniendo el control de acceso y ocultando allí la identidad real. El Toaster global usa la misma guarda mediante suscripción de React porque vive fuera del árbol tenant: así una respuesta tardía de otro módulo no puede insertar un aviso real en la grabación. Los pagos e inversiones del escenario conservan importes/identificadores al filtrar por sucursal; se verificó esta estabilidad durante el segundo build.

## La sesión tenant se reutiliza, no se prolonga artificialmente

Para reducir logins repetidos se aprovecha la sesión que Supabase ya persiste
en `localStorage` y renueva con refresh tokens. La homepage permanece pública;
el acceso por `/login` restaura la sesión si aún es válida y delega la
verificación de organización a la ruta protegida. No se agregan cookies propias,
un control “recordarme” ni un JWT más largo: sumarían complejidad o riesgo sin
resolver el fallo de carga del perfil. La duración real sigue gobernada por la
configuración central de Supabase, que debe verificarse en producción antes de
prometer un plazo concreto. Un logout explícito siempre exige un login nuevo.

Las lecturas del contexto tenant usan reintentos acotados solo para errores
transitorios y cancelación de peticiones. Mantener la sesión ante un fallo REST
permite que “Reintentar” recupere la fase fallida sin contraseña; asociar cada
respuesta a usuario/organización evita mostrar datos de un tenant anterior.
Una ausencia confirmada, 401 o denegación de permisos no se reintenta
automáticamente.

=======
>>>>>>> ae6527928838a5c5d089f7247c2d6a7fd0897d8d
## Por qué existe la regla de color de chip

La especificación vigente (`bg-primary/10` = se edita acá, `bg-muted` = atajo
o solo lectura) vive en `DESIGN.md` → Colors → Named Rules. Acá solo el
porqué: surgió de una auditoría sobre Configuración de reservas, donde 3
tratamientos de chip convivían sin regla escrita. Se declaró explícitamente
y ya se aplicó retroactivamente en Portal público ("Compartir tu portal"
corregido de primary a muted, porque no edita nada).

## Portal público no está migrado al canon de formularios

A diferencia de Configuración de reservas (RHF+Zod completo, modo
lectura/edición por card), Portal público sigue siendo un formulario
siempre-editable con guardado mixto (instantáneo para logo/portada,
diferido con botón para el resto). Es una divergencia temporal conocida,
no un error — migrarlo del todo requiere decidir primero cuál de los dos
modelos de guardado se adopta (Fase 5, pendiente).

## La vista previa de Portal público es el portal real

`PortalPreview.tsx` no es una maqueta — renderiza el mismo componente
(`BookingLanding`) que ve el cliente final en `Reservar.tsx`. Decisión
correcta (la preview nunca puede mentir), pero implica que no se puede
rediseñar visualmente sin tocar el portal público real.

## Horarios: editor único, múltiples puertas de entrada

Se descartó duplicar el editor de horarios en Mi Negocio y en Turnos.
El editor vive en un solo lugar (Mi Negocio → ficha de Sucursal) y Turnos
tiene un acceso directo. Motivo: el editor de horario del barbero necesita
ver el horario de la sucursal al mismo tiempo (para copiar como base o
comparar contra el override) — separarlo en dos pantallas hubiera roto esa
referencia cruzada.
