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

Conocido y documentado, no resuelto: flash de esqueleto en 5 disparadores
de guardado (subir/quitar logo, subir/quitar portada, ajustar encuadre,
submit general); dos modelos de guardado sin señal visual que los distinga.

## Horarios de trabajo

Ya no vive en este módulo — ver Mi Negocio → ficha de Sucursal →
"Horarios de atención". Este módulo conserva solo un acceso directo
(`HorariosAccesoDirectoCard.tsx`).
