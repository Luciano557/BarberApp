# Estado actual — Vittro

Última actualización: 2026-08-18

## Turnos / Agenda

**Configuración de reservas**: migrado al canon (RHF+Zod, modo lectura/edición
por card, accesibilidad P1 resuelta). Score impeccable: 18/20.

**Portal público**: parcialmente migrado. Fase 1+2+3 (accesibilidad + ruido
de contenido + consistencia de chip) completa. Fase 7 (bloque Compartir +
Vista previa arriba, no sticky) completa. Pendientes: Fase 4 (flash de
esqueleto al guardar), Fase 5 (unificar modelo de guardado instantáneo vs.
diferido — requiere decisión de producto), Fase 6 (cajas nativas al
componente compartido). El h2 anidado dentro de la vista previa (BookingLanding)
sigue sin resolver — requiere tocar el componente del portal público real.

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
