## Contexto
Se necesita agregar soporte para push notifications almacenando tokens de dispositivo por usuario y organización.

## Verificación de esquema
- Tabla `organizations` existe en `public` y su columna `id` es `uuid` NOT NULL (confirmado vía `information_schema.columns`).
- `auth.users(id)` es la tabla estándar de autenticación de Supabase y el proyecto ya la utiliza indirectamente (perfiles, roles, etc.).
- El SQL no usa prefijo `public.` en `push_tokens` ni en `organizations`, pero Supabase resuelve `organizations` como `public.organizations` por `search_path` por defecto.

## Migración propuesta (SQL exacto)
```sql
create table push_tokens (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  organization_id uuid not null references organizations(id) on delete cascade,
  token text not null,
  platform text not null default 'android',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, token)
);

create index idx_push_tokens_org on push_tokens(organization_id);

alter table push_tokens enable row level security;

create policy "usuarios ven solo sus propios tokens"
  on push_tokens for select
  using (auth.uid() = user_id);

create policy "usuarios insertan solo su propio token"
  on push_tokens for insert
  with check (auth.uid() = user_id);

create policy "usuarios actualizan solo su propio token"
  on push_tokens for update
  using (auth.uid() = user_id);
```

## Proceso
1. Crear el archivo de migración con el SQL exacto de arriba usando la herramienta de migraciones de Supabase.
2. Presentar el archivo para revisión sin aplicarlo a la base de datos.
3. Aplicar solo cuando vos confirmes explícitamente.

## Nota importante sobre permisos
El SQL proporcionado no incluye sentencias `GRANT`. En este proyecto, las tablas en el esquema `public` requieren `GRANT` explícito para `authenticated` y `service_role` según las reglas del proyecto; de lo contrario, PostgREST devolverá errores de permiso. Recomiendo agregar al SQL antes de aplicar:
```sql
GRANT SELECT, INSERT, UPDATE ON public.push_tokens TO authenticated;
GRANT ALL ON public.push_tokens TO service_role;
```
Si preferís mantener el SQL exacto tal como lo pasaste, lo dejo con tu aprobación.