## Onboarding guiado para owners (Paso 1 — Configurar Mi Negocio)

### Decisiones
- **Persistencia**: tabla nueva `user_onboarding` (un registro por usuario). Más robusto y extensible que un campo en `profiles`. Guarda progreso por paso para tolerar cierres inesperados: el onboarding se reanuda exactamente donde quedó.
- **Sucursales**: ya existe siempre "Casa Central" auto-generada → no hace falta sub-paso de creación. Pasos 1.3+ entran directo a esa sucursal.
- **Relanzable**: botón "Ver tutorial otra vez" en Configuración → resetea el progreso y arranca de nuevo.

### Esquema DB
```sql
create table public.user_onboarding (
  user_id uuid primary key references auth.users(id) on delete cascade,
  current_step text,                -- id del paso actual, null = no iniciado
  completed_steps text[] default '{}',
  status text not null default 'pending', -- 'pending' | 'in_progress' | 'completed' | 'skipped'
  started_at timestamptz,
  completed_at timestamptz,
  updated_at timestamptz default now()
);
-- RLS: cada usuario lee/escribe su propio registro
```
- Cada `next()` hace upsert con `current_step` y push a `completed_steps`. Si el usuario cierra la app a mitad, al volver a entrar reanuda desde `current_step`.
- `skip()` → `status='skipped'`. `finish()` → `status='completed'`.
- "Ver tutorial otra vez" → reset (`status='pending'`, `current_step=null`, `completed_steps='{}'`).

### Arquitectura frontend

```text
src/components/onboarding/
  OnboardingProvider.tsx     ← contexto global: estado, next/skip/finish/restart
  OnboardingOverlay.tsx      ← overlay oscuro + spotlight recortado al target
  OnboardingTooltip.tsx      ← tooltip moderno con flecha + acciones
  steps.ts                   ← definición declarativa de los 7 pasos
  useOnboardingTarget.ts     ← helper para registrar/buscar targets por id
src/hooks/useOnboardingState.ts ← lectura/escritura de user_onboarding
```

#### Provider
- Al login (owner only): consulta `user_onboarding`. Si `status` ∈ {pending, in_progress} → activa overlay en `current_step` o paso inicial.
- API: `next()`, `skip()`, `restart()`, `goTo(id)`.
- Mientras `isActive`: intercepta `AppSidebar.onTabChange` para permitir solo los tabs habilitados por el paso vigente.

#### Overlay + spotlight
- Fixed full-screen, `z-[60]`, `bg-foreground/60` con `backdrop-blur-[1px]`.
- Spotlight: 4 divs perimetrales calculados desde `getBoundingClientRect()` del target (con `pointer-events-auto` para bloquear el resto). El target queda interactivo.
- Recalcula con `ResizeObserver` + `MutationObserver` + listeners scroll/resize.
- Padding 8px y `border-radius` heredado. Transición CSS suave (`transition-all duration-300`).
- Ring sutil alrededor del recorte (`ring-1 ring-primary/30`).

#### Tooltip
- Anclado al target con shadcn `Popover` + `PopoverArrow`. z por encima del overlay.
- Contenido: título (`text-base font-semibold`), descripción (`text-sm text-muted-foreground`), indicador "n / 7", botón primario "Continuar", link discreto "Omitir tutorial".
- Animación: `animate-fade-in` + `scale-in` ya disponibles.

#### Targets (atributo `data-onboarding-id`)
| id | Componente |
|---|---|
| `mi-negocio-nav` | item del sidebar (`AppSidebar.tsx`) |
| `cuentas-sucursal-section` | bloque `CuentaSucursalBlock` |
| `cuentas-sucursal-bullets` | wrapper con los 3 textos clave (1.2 sub-estado) |
| `info-sucursal-section` | card "Información de la sucursal" |
| `equipo-section` | bloque `EquipoUnificado` |
| `servicios-section` | catálogo Servicios |
| `extras-productos-section` | extras / productos / descuentos |
| `metodos-pago-section` | `PaymentMethodsConfig` |

#### Pasos (`steps.ts`)
Lineal, cada uno con `{ id, targetId, title, description, requiredTab?, beforeEnter?() }`.
- 1.1 sidebar Mi Negocio → 1.2 Cuentas de sucursal (intro) → 1.2b textos destacados → 1.3 Info sucursal → 1.4 Equipo → 1.5 Servicios → 1.6 Extras/productos/descuentos → 1.7 Métodos de pago.
- `beforeEnter` puede forzar tab `mi-negocio` o abrir tab de Casa Central.

### Cambios por archivo
- **Migración DB**: tabla `user_onboarding` + RLS.
- **`src/App.tsx`**: envolver con `<OnboardingProvider>` dentro de `AuthProvider`.
- **`src/pages/Index.tsx`**: render de `<OnboardingOverlay />` y `<OnboardingTooltip />` a nivel de `main`. Exponer setter de tab al provider.
- **`src/components/AppSidebar.tsx`**: `data-onboarding-id="mi-negocio-nav"`; bloquear tabs no permitidos durante onboarding.
- **`src/components/MiNegocioPanel.tsx`** + **`SucursalTabContent.tsx`** + **`CuentaSucursalBlock.tsx`** + **`EquipoUnificado.tsx`** + **`PaymentMethodsConfig.tsx`**: agregar atributos `data-onboarding-id` en las cards correspondientes.
- **`src/components/ConfigurationPanel.tsx`** (o `ConfigMenu.tsx`): botón "Ver tutorial otra vez" que llama a `restart()`.
- Nuevos archivos en `src/components/onboarding/` y `src/hooks/useOnboardingState.ts`.

### UX / estilo
- Tokens semánticos (`bg-popover`, `text-foreground`, `border-border`, `primary`). Sin colores directos.
- Tooltip: `rounded-xl border bg-popover shadow-lg p-4 max-w-sm`.
- Sin emojis. Copy breve, claro, en línea con la voz Vittro.
- Animaciones suaves (200–300ms), inspiración Notion/Linear.

### Edge cases
- Target no montado: `MutationObserver` espera hasta 3s, luego salta paso.
- Resize/scroll/cambio de DOM: recálculo automático.
- Cierre de la app a mitad: al volver, reanuda en `current_step` (gracias a la persistencia por paso).
- "Omitir": confirma con AlertDialog breve, marca `skipped`.
- No-owner: provider no se activa.

### No incluye
- Cambios funcionales en módulos existentes.
- Onboarding para roles distintos a owner.
- Pasos posteriores al 1.7.
