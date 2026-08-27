# Vittro — Guía para agentes de IA

SaaS multi-tenant de gestión para barberías. Maneja facturación y datos
financieros de múltiples clientes (barberías/organizaciones). La privacidad
y separación de datos entre clientes es prioridad central.

## Stack

React 18 + Vite + TypeScript + Tailwind CSS + shadcn/ui (Radix) + Supabase
(Auth, Postgres, Edge Functions en Deno, Storage) + React Query v5 +
React Router 6 + React Hook Form + Zod.

## Regla no negociable: aislamiento multi-tenant

Toda tabla operativa requiere `organization_id` + `sucursal_id`. RLS activa
en todas las tablas con datos de organización. Nunca asumir que RLS sola
alcanza en edge functions que usan `service_role` — validar propiedad/permisos
explícitamente en el código de la función.

Roles (tabla `user_roles`, FK a `auth.users`, resueltos vía `has_role()`
`SECURITY DEFINER` para evitar recursión): `owner`, `general_manager`,
`manager`, `barber`, `sucursal_account`, `otros`. El scope multi-sucursal de
un usuario vive en `user_sucursales`.

## Regla de CSS: overflow:clip, no overflow:hidden

Toda sección que combine un toolbar (controles de navegación) con un panel
de contenido scrolleable debe envolverse en un único card, con el toolbar
como header separado por `border-bottom`. El wrapper nunca debe usar
`overflow:hidden` si contiene elementos `sticky` — usar `overflow:clip`.
(`overflow:hidden` convierte al contenedor en su propia zona de scroll y
rompe el sticky positioning; `overflow:clip` recorta visualmente sin ese
efecto colateral.)

## Funciones SQL

`SECURITY INVOKER` es el default para toda función nueva. Si se vuelve
necesario `SECURITY DEFINER`, es obligatorio detenerse y reportarlo antes
de aplicar — no es una decisión que se tome sola.

## Dónde se trabaja cada cosa

- **Lovable**: auditorías (más económico), cambios de base de datos y RLS.
- **VS Code + Claude Code**: builds de UI, trabajo visual de precisión,
  auditorías profundas. Skills disponibles: `/impeccable` (UX/diseño),
  `/motion-craft` (animación).
- **Supabase MCP** (proyecto `azqpyfoobpovqosbayvz`): consultas SQL directas
  de solo lectura y migraciones puntuales. Desconectar durante sesiones de
  auditoría de seguridad.

DB/RLS van por Lovable. Excepciones puntuales requieren autorización
explícita y quedan documentadas como tales cuando ocurren.

## Proceso de trabajo

Todo cambio sigue: idea → auditoría (solo lectura, sin proponer cambios) →
contraste (si la auditoría choca con la idea original, se resuelve antes de
seguir) → plan (propuesta sin tocar código, iterable) → build (solo tras
plan aprobado). Cambios grandes se dividen en etapas. Visual y lógica/datos
nunca se mezclan en el mismo build.

## Documentación — obligación post-build

Después de cada build cerrado y validado (con evidencia real — `git diff`
o archivos, no autoreporte del agente), actualizar la documentación
correspondiente antes de dar la tarea por cerrada. Ver `docs/INDICE.md`
para la estructura completa.

Criterios visuales y de diseño: ver `DESIGN.md` (raíz del repo) — **fuente de
verdad activa del sistema visual** — y `DESIGN_BACKLOG.md` (deuda y migraciones
pendientes). `docs/archivo/CRITERIOS_DISEÑO.md` es la bitácora de auditorías
que precedió a `DESIGN.md`, archivada: consultarla como historial, no como
instrucción activa. No se duplican acá.
