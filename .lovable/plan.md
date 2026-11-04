# Tareas — progreso semanal: diagnóstico y corrección

## A. Diagnóstico (certeza alta, verificado contra la base en vivo)

**Causa raíz:** dos migraciones de Tareas están en el repositorio pero **nunca se aplicaron** en la base de producción (`azqpyfoobpovqosbayvz`). El frontend publicado ya usa lo que esas migraciones crean.

Punto exacto del fallo:
- `TareasPanel.tsx:133` → `errorSemana = resueltas.error ?? previstas.error`.
- `useTareasSemana.ts:37` llama a la función `tareas_previstas` (próximas ocurrencias de tareas automáticas). **Esa función no existe** en la base (consulta a `pg_proc`: 0 resultados) → error de la base → bloque "No pudimos cargar el progreso de la semana".
- No es conexión: el mensaje genérico oculta el error real.

Por qué el resto funciona: la lista de tareas lee la tabla `tareas` directamente con las políticas viejas, que siguen vigentes. Solo el progreso depende de la función nueva.

## B. Estado de la base

| Migración | En repo | Aplicada | Evidencia |
|---|---|---|---|
| `20261014120000_tareas_acciones_controladas` | sí | **no** | sin esquema `tareas_private`, sin `tareas_previstas`/`tareas_accion`, sin columnas `iniciada_*`/`accion_version`, sin políticas `tareas_4a_*` |
| `20261015120000_tareas_aviso_semanal` | sí | **no** | tabla `tareas_aviso_semanal` inexistente |
| migraciones partner (130000–230000) | sí | sí | presentes en `schema_migrations` |

Las migraciones partner, posteriores, sí se aplicaron: la de Tareas quedó salteada (tiene la nota "No aplicar en producción sin autorización").

**Impacto adicional (mismo origen):** también deberían estar fallando hoy iniciar/completar tareas vía `tareas_accion` (`useTareaAcciones.ts`, edge function `tareas-action`) y el aviso semanal (`useAvisoSemanalTareas.ts`). Falta confirmarlo en la vista previa.

Condiciones previas verificadas: 0 tareas sin sucursal (la migración aborta si hubiera), 2 filas totales en `tareas`.

## C. Plan de corrección

No se toca el frontend: el código ya espera este esquema.

1. **Aplicar `20261014120000` tal cual está en el repo**, en una sola transacción (el archivo ya tiene `BEGIN`/aborta solo ante datos inconsistentes). Crea:
   - esquema privado `tareas_private` con funciones de alcance/acción/previstas;
   - columnas nuevas en `tareas` (no destructivas, con default);
   - constraint de sucursal obligatoria para `tipo='tarea'`;
   - nuevas políticas de lectura/escritura y restricción de managers a su sucursal;
   - quita a los clientes el acceso directo a `barberos.pin_hash` (mejora de seguridad).
2. **Aplicar `20261015120000`** (tabla `tareas_aviso_semanal` con RLS y permisos).
3. Verificar: la función existe con permiso para usuarios logueados, y en la vista previa el progreso semanal carga, iniciar/completar funciona y el aviso semanal no da error. Probar como owner y como barbero, y una semana sin tareas. Correr los tests existentes (`tareasReads.test.tsx`, `TareasReliability.test.tsx`, `AvisoSemanalTareas.test.tsx`).
4. Documentar en `docs/` el incidente y la regla: migraciones con nota "requiere autorización" deben quedar registradas como pendientes.

## Punto que requiere tu decisión (regla del proyecto)

La migración 1 usa **SECURITY DEFINER** en funciones del esquema privado (`tareas_private.*`, excepción ya autorizada en su momento para el build 4A; ninguna nueva en `public`). Según AGENTS.md, esto debe aprobarse explícitamente antes de aplicar en producción. **Aprobar este plan = autorizar esa excepción y el despliegue.**

## Riesgos y reversión

- Riesgo principal: las políticas nuevas cambian quién ve qué tarea (managers quedan limitados a sus sucursales). Es el comportamiento diseñado, pero se valida con dos roles.
- Quitar acceso directo a `pin_hash`: si alguna pantalla lo lee directo, fallaría; el diseño usa `set-pin`/`barberos_pin_status`. Se revisa en la validación.
- Reversión: borrar esquema `tareas_private`, políticas `tareas_4a_*`, constraint, funciones `public.tareas_*`, tabla `tareas_aviso_semanal`; las columnas nuevas pueden quedar sin efecto. Sin pérdida de datos existentes.
