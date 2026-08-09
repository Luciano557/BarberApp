# Índice de documentación — Vittro

Punto de entrada a todo el contexto del proyecto. Si estás explorando el repo por primera vez en esta sesión, empezá por acá.

---

## 📄 Documentos

| Archivo | Para qué sirve |
|---|---|
| [`ESTADO_ACTUAL.md`](./ESTADO_ACTUAL.md) | Qué está en curso ahora mismo, qué se cerró recientemente, qué sigue. Se reescribe después de cada build. **Leer primero.** |
| [`DECISIONES.md`](./DECISIONES.md) | Por qué se tomaron ciertas decisiones técnicas. Consultar antes de proponer revertir o cambiar algo que "parece raro" — puede que ya haya una razón documentada. |
| [`CRITERIOS_DISEÑO.md`](./CRITERIOS_DISEÑO.md) | Reglas fijas de diseño/UX (z-index, overflow, contenedores de formularios, etc.). |
| [`MODULOS/`](./MODULOS/) | Un archivo por módulo funcional: propósito, archivos clave, tablas de Supabase, cómo funciona, gotchas no obvios. |

---

## 🗂️ Módulos documentados

_(se completan a medida que se tocan en builds futuros — todavía no hay ninguno con ficha propia)_

- [ ] Agenda / Turnos
- [ ] Cobrar / Caja
- [ ] Finanzas (gastos, sueldos, inversiones, deudas)
- [ ] Clientes
- [ ] Portal público de reservas
- [ ] Equipo y permisos
- [ ] Estadísticas
- [ ] Notificaciones

---

## ⚠️ Regla de confianza en esta documentación

Cada archivo de módulo tiene una fecha de "última verificación completa". La documentación puede desactualizarse — el código real siempre manda. Si vas a tocar algo sensible (multi-tenant, RLS, finanzas) y la última verificación es vieja, hacé una auditoría puntual antes de confiar ciegamente en lo que dice acá.

---

## 🔗 Ver también

- `AGENTS.md` (raíz del repo) — contexto universal para agentes de IA, incluye la obligación de mantener esta documentación al día.
- `CLAUDE.md` (raíz del repo) — específico de Claude Code, redirige a `AGENTS.md`.
