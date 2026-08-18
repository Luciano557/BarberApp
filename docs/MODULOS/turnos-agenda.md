# Módulo: Turnos / Agenda

## Estructura de pestañas

Nivel 1: Agenda | Configuración (título superior dinámico: "Turnos" en
Agenda, "Configuración" en la otra).

Nivel 2 (dentro de Configuración): Configuración de reservas | Portal
público, con flecha "atrás" hacia Agenda en la misma fila.

## Configuración de reservas

Archivos: `AgendaConfigSection.tsx`, `HorariosAccesoDirectoCard.tsx`,
`BloqueosSection.tsx`. RHF+Zod completo, modo lectura/edición por Card
(2 useForm separados, exclusión mutua). Chips: `SlidersHorizontal` (Reglas),
`CalendarX` (Límites), ambos `bg-primary/10`.

## Portal público

Archivos: `PortalPublicoSection.tsx` (orquestador), `PortalLinksEditor.tsx`,
`PortalCoverUploader.tsx`, `PortalColorPalette.tsx`,
`PortalCoverPositionDialog.tsx`, `PortalPreview.tsx`, `usePortalConfig.ts`.

Layout actual: bloque superior (Compartir tu portal + Vista previa, no
sticky) + columna única de 768px debajo (Identidad visual, Contenido del
portal, Integraciones).

**Migración en curso al patrón de modo lectura/edición** (mismo canon que
`AgendaConfigSection.tsx`, ver abajo — pieza a pieza, una sección por fase).
**Integraciones (Fase 9) ya migró**, piloto de la migración: `useForm`
propio (`integracionesForm`, schema `integracionesSchema` recortado solo a
`metaPixelId`), estado `editing: 'integraciones' | null` (union a expandir
en las próximas fases, sin reescribir el mecanismo), `saving` reusado
directo del `usePortalConfig()` ya existente (sin estado nuevo — más
completo que el `saving` manual de `AgendaConfigSection`, porque ya cubre
cruces con logo/portada/encuadre). Guarda con `save({ meta_pixel_id })`
independiente del resto de la pantalla. Modo lectura muestra el valor
guardado o "—" en gris itálica si está vacío (mismo patrón que
`ClienteDetailDialog.tsx` para campos opcionales).

Detalle técnico no obvio: la sección "Integraciones" quedó **fuera** del
`<form id="portal-form">` que sigue envolviendo Identidad visual + Contenido
del portal — un `<form>` no puede anidar otro, y aunque no lo anidara, un
Enter dentro de su campo igual dispararía el submit del `<form>` que lo
contenga en el DOM (comportamiento nativo del navegador, ajeno a qué
`useForm`/`control` de React esté atado el input). El botón "Guardar
cambios" (que ahora solo cubre Identidad+Contenido) quedó también fuera del
`<form>`, referenciándolo por `form="portal-form"` — mismo comportamiento
nativo, sin tocar Identidad/Contenido.

Pendiente (Fase 10, 11): Contenido del portal e Identidad visual siguen en
el `useForm` monolítico de siempre, con el guardado único de "Guardar
cambios". Identidad visual tiene una decisión de producto ya tomada para
cuando le toque: Logo y portada se separan en su propia Card sin
Editar/Guardar, mantienen el autosave actual tal cual.

**Fase 4 (loading local por disparador) completa.** `usePortalConfig.ts`:
`fetch(opts?: { silent?: boolean })` — el refetch interno de `save()` pasa
`{ silent: true }`, así que ya no dispara `setLoading(true)` (eso era lo que
hacía saltar el `<Skeleton>` completo en cada guardado; el `useEffect` de
carga inicial sigue sin `silent`, sin cambios ahí). En
`PortalPublicoSection.tsx`, cada uno de los 5 disparadores tiene su propio
estado local que cubre el ciclo completo (upload + save, no solo la mitad):
`uploadingLogo`/`uploadingCover` (ya existían, se extendió su alcance),
`removingLogo`/`removingCover` (nuevos). Encuadre y submit general ya
estaban correctos (`saving`/`savingAll`) y no se tocaron.

Asimetría conocida, no un bug: "Quitar portada" solo queda `disabled`
durante el ciclo, sin texto "Quitando..." — a diferencia de "Quitar logo".
El botón vive dentro de `PortalCoverUploader.tsx` con label hardcodeado y
un único prop `disabled` genérico compartido con "Ajustar portada"; ese
archivo quedó fuera del alcance de este build. Si se quiere simetría total,
requiere una prop nueva en `PortalCoverUploader.tsx` (build aparte).

Dos modelos de guardado sin señal visual que los distinga (instantáneo vs.
diferido) — eso es Fase 5, sigue pendiente, sin tocar acá.

## Horarios de trabajo

Ya no vive en este módulo — ver Mi Negocio → ficha de Sucursal →
"Horarios de atención". Este módulo conserva solo un acceso directo
(`HorariosAccesoDirectoCard.tsx`).
