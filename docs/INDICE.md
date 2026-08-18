# Índice de documentación — Vittro

Mapa de la documentación del proyecto. Objetivo: que un agente nuevo pueda
hacer verificación dirigida en vez de auditoría exploratoria completa.

## Archivos de este sistema

| Archivo | Qué contiene |
|---|---|
| `AGENTS.md` (raíz) | Contexto universal para cualquier agente de IA: stack, reglas no negociables, proceso de trabajo |
| `CLAUDE.md` (raíz) | Redirección a `AGENTS.md` + reglas específicas de Claude Code |
| `CRITERIOS_DISEÑO.md` (raíz) | Sistema de diseño: tokens, componentes, patrones ya resueltos, auditorías visuales acumuladas |
| `docs/ESTADO_ACTUAL.md` | Foto del estado de cada módulo grande de la app |
| `docs/DECISIONES.md` | Registro de decisiones de arquitectura/criterio y su porqué |
| `docs/MODULOS/` | Un archivo por módulo, con detalle de su funcionamiento actual |

## Módulos documentados en `MODULOS/`

- [x] `turnos-agenda.md` — Configuración de reservas, Portal público, Horarios de trabajo
- [ ] Cobrar
- [ ] Finanzas
- [ ] Mi Negocio (general)
- [ ] Clientes
- [ ] Estadísticas
- [ ] Tareas
- [ ] Notificaciones

Los módulos sin marcar no tienen documentación propia todavía — no auditados
a fondo. No asumir que están al día con el canon de diseño solo porque no
aparecen acá.

## Cuándo actualizar esto

Después de cada build cerrado y validado que toque un módulo: actualizar
`ESTADO_ACTUAL.md`, sumar la entrada correspondiente en `DECISIONES.md` si
hubo una decisión de criterio, y crear/actualizar el archivo de `MODULOS/`.
