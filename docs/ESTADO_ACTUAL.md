# Estado actual — Vittro

Última actualización: 2026-08-18

## Turnos / Agenda

**Configuración de reservas**: migrado al canon (RHF+Zod, modo lectura/edición
por card, accesibilidad P1 resuelta). Score impeccable: 18/20.

**Portal público**: parcialmente migrado. Fase 1+2+3 (accesibilidad + ruido
de contenido + consistencia de chip) completa. Fase 7 (bloque Compartir +
Vista previa arriba, no sticky) completa. Fase 4 (flash de esqueleto al
guardar) completa: los 5 disparadores de guardado (subir/quitar logo,
subir/quitar portada, ajustar encuadre, submit general) ya no reemplazan la
pantalla completa por el `<Skeleton>` — cada uno muestra su propio estado de
carga local (disabled + texto). **Fase 9 (piloto de migración a modo
lectura/edición) completa**: "Integraciones" es la primera sección migrada
al patrón `EditableSectionHeader` (mismo canon que Configuración de
reservas) — tiene su propio `useForm`, guarda de forma independiente del
resto de la pantalla, y ya no requiere pasar por "Guardar cambios". Sigue en
curso la migración del resto: Identidad visual y Contenido del portal
todavía comparten el `useForm` monolítico de siempre, con guardado único al
pie de la pantalla. Pendientes: Fase 10 (Contenido del portal → Card),
Fase 11 (Identidad visual → Card, con la decisión ya tomada de separar
Logo/portada en su propia Card sin ciclo Editar/Guardar), Fase 12 (vista
previa en vivo durante edición — sin resolver todavía, Integraciones no
sirvió de caso de prueba porque no alimenta la preview), Fase 5 (unificar
modelo de guardado instantáneo vs. diferido — requiere decisión de
producto), Fase 6 (cajas nativas al componente compartido). El h2 anidado
dentro de la vista previa (BookingLanding) sigue sin resolver — requiere
tocar el componente del portal público real.

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
