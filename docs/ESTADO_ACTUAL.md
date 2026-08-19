# Estado actual — Vittro

Última actualización: 2026-08-20

## Turnos / Agenda

**Configuración de reservas**: migrado al canon (RHF+Zod, modo lectura/edición
por card, accesibilidad P1 resuelta). Score impeccable: 18/20.

**Portal público**: migración a modo lectura/edición prácticamente completa.
Fase 1+2+3 (accesibilidad + ruido de contenido + consistencia de chip)
completa. Fase 7 (bloque Compartir + Vista previa arriba, no sticky)
completa. Fase 4 (flash de esqueleto al guardar) completa. **Fase 9+10+11
completa** (esta última junta 2 fases originalmente separadas, a pedido
explícito): las 4 secciones de la pantalla — Logo y portada, Nombre y
color, Contenido del portal, Integraciones — están migradas. Las 3 con
campos que requieren guardado explícito (Nombre y color, Contenido,
Integraciones) usan `EditableSectionHeader` + `useForm` propio, cada una
con guardado independiente. "Logo y portada" es la única sin modo edición
— sigue siendo autosave puro, por decisión de producto (no tiene sentido
forzar un ciclo Editar/Guardar sobre campos que ya persisten al instante).

**Fase 13 (limpieza del form legacy) completa.** El `<form id="portal-form">`
y el `useForm` que sostenían logo/portada como "contenedor reactivo" ya no
existen — se reemplazaron por un `useState<PortalMedia>` simple. Motivo: el
schema de ese form estaba vacío (`z.object({})`, con un cast `as unknown as`
que tapaba el desajuste de tipos) y su `isDirty` era matemáticamente
imposible de volverse `true` (los 13 `setValue` que lo alimentaban pasaban
`shouldDirty: false` sin excepción) — un componente RHF completo sosteniendo
5 campos que nunca se validan ni ensucian. Cero cambio de comportamiento:
el autosave de logo/portada (subir, quitar, ajustar encuadre) funciona
idéntico, y `previewPortal` sigue reflejando esos campos en vivo.

**Las 5 secciones de la pantalla usan `<Card>` de forma consistente** —
"Compartir tu portal" fue la última en migrar (mantiene su chip `bg-muted`,
sin modo edición, solo cambia el envoltorio visual).

La vista previa en vivo (`previewPortal`) ya combina fuentes condicionales
por primera vez: mientras Contenido o Nombre y color están en edición, la
preview sigue el borrador de su `useForm`; si no, refleja lo último
guardado (`config`/`organization`). Logo y portada, al ser autosave sin
`editing`, no lleva condicional — siempre refleja el valor más reciente.
Con esto, **Fase 12 (preview en vivo durante edición) queda resuelta** como
efecto colateral de esta fase, no como fase aparte.

**"Compartir tu portal" con pestañas** (mismo `SegmentedControl`, ancho
acotado `sm:max-w-xs`): Link público / QR en vez de apilados; abre en Link,
que es la acción más frecuente. "Descargar QR" vive dentro del panel QR.
La sección mantiene su chip `bg-muted` — sigue sin campos editables.
Pendiente derivado: el `<Skeleton>` de carga inicial todavía espeja el
layout apilado anterior (muestra URL + cuadrado de QR a la vez), quedó
fuera del alcance de ese build — ver `MODULOS/turnos-agenda.md`.

**"Logo y portada" con pestañas** (`SegmentedControl`, no `EditableSectionHeader`
— sigue sin modo edición): el dropzone de portada dominaba la pantalla con
un rectángulo desproporcionado al mostrarse siempre junto al logo; ahora
alterna Logo/Portada con el mismo pill navy que usa el resto de la app para
filtros, abre en "Logo" por defecto. Autosave sin cambios de comportamiento
— cambiar de pestaña con una subida en curso no la interrumpe.

Pendientes: Fase 5 (unificar modelo de guardado instantáneo vs. diferido —
con esta fase la convivencia de los dos modelos quedó más nítida, no
resuelta: Logo/portada es instantáneo por decisión de producto, las otras 3
secciones son diferidas por Editar/Guardar; sigue siendo una decisión de
producto pendiente, no técnica), Fase 6 (cajas nativas al componente
compartido). El h2 anidado dentro de la vista previa (BookingLanding)
sigue sin resolver — requiere tocar el componente del portal público real.
Deriva conocida sin resolver: el `<Skeleton>` de carga inicial de Compartir
tu portal sigue espejando el layout apilado anterior a las pestañas
Link/QR — ver `MODULOS/turnos-agenda.md`.

**Horarios de trabajo**: reubicados de Turnos a Mi Negocio → ficha de
Sucursal, sección "Horarios de atención" con pestañas Sucursal/Barberos.
Turnos conserva un acceso directo.

## Resto de módulos

No relevados a fondo en el sistema de documentación actual. Ver
`CRITERIOS_DISEÑO.md` para auditorías puntuales previas (Mi Negocio,
Estadísticas, Finanzas) que no se trasladaron todavía a este formato.

## Deuda técnica conocida, sin resolver

- 187 issues del linter de seguridad de Supabase (RLS gaps, SECURITY DEFINER
  views, funciones con search_path mutable) — pendiente de sesión de auditoría
  dedicada.
- Bug de notificaciones leídas que reaparecen (hipótesis: `notification_reads`
  legacy huérfano al cambiar `notifications.type`) — sin fix.
- Bug post-login intermitente — refactor parcial aplicado, cadena
  Auth→Org→Sucursal sigue siendo secuencial.
