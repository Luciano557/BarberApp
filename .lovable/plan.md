# Plan: Refinar el portal público de reservas y propagar el color de marca

## Objetivos
- Más profundidad visual: fondo gris muy suave, cards blancas, subcards gris claro, bordes sutiles y sombras mínimas.
- Mejor jerarquía tipográfica entre títulos, subtítulos, labels y texto secundario.
- En desktop dejar de tener pantalla vacía: agregar columna lateral con resumen persistente de la reserva.
- Propagar el color principal configurado (`portal_config.primary_color`) a TODO el flujo público — no solo a la landing.

## Cambios estructurales (sin tocar lógica)

### 1. Tema del portal — `src/pages/Reservar.tsx`

Envolver todo el portal en un contenedor que defina variables CSS locales según `orgData.portal.primary_color`. Este contenedor:

- Sobrescribe los tokens HSL `--primary`, `--ring`, y agrega `--portal-primary` (HEX directo, para usos puntuales) y `--portal-primary-soft` (color con alpha bajo para fondos de selección).
- Define `--portal-bg` (gris muy suave) y `--portal-subcard` (gris claro) para no depender de `bg-muted` global.

Helper nuevo `src/components/reservar/lib/portalTheme.ts`:
- `hexToHsl(hex)` → retorna `"H S% L%"` (string, formato que Tailwind/shadcn ya usa).
- `getPortalThemeStyle(primaryHex | null)` → devuelve un `React.CSSProperties` con todas las variables. Si no hay color válido, no setea overrides (queda el tema por defecto).

Aplicar el style al wrapper más externo del portal (no al `<body>`, para no contaminar el resto de la app cuando se vuelve a otras rutas).

### 2. Layout nuevo — `Reservar.tsx`

```text
┌──────────────────────────────────────────────────────┐
│  bg: gris suave (var(--portal-bg))                   │
│  ┌──────────── Card principal ─────────┬──────────┐  │
│  │  Header: logo + nombre              │ Sidebar  │  │
│  │  Stepper / contenido del paso       │ resumen  │  │
│  │  bg-card · sombra sutil · radius    │ (lg+)    │  │
│  └─────────────────────────────────────┴──────────┘  │
│  Powered by Vittro                                   │
└──────────────────────────────────────────────────────┘
```

- En mobile, sidebar resumen colapsa a una franja superior debajo del progress (chips actuales).
- En `lg+` (>=1024px), grid de 2 columnas: contenido (col-span-2) + `BookingSummarySidebar` sticky.

### 3. Sidebar de resumen — nuevo componente `src/components/reservar/BookingSummary.tsx`

Recibe el `BookingState` y muestra:
- Sucursal · Servicio · Barbero · Fecha · Hora · Precio (cuando estén definidos).
- Items vacíos en estado "—" con `text-muted-foreground` para que la tarjeta no parezca vacía aún antes de elegir.
- Encabezado "Tu reserva" + chip de paso actual.
- Estilo: subcard `bg-muted/50` con borde sutil; cada item con icono `lucide` mono.

En mobile el mismo componente se renderiza como bloque compacto colapsable o, más simple, como la tira de chips actual ya existente en `BookingStepper`.

### 4. Restyling visual de los steps

Sin tocar handlers ni props. Solo clases:

- Tarjetas seleccionables (`SucursalStep`, `ServicioStep`, `BarberoStep`):
  - Reemplazar tarjetas planas por cards con `bg-card`, `border border-border`, `rounded-xl`, `hover:bg-muted/40`, `transition-colors`.
  - Estado seleccionado: `border-primary`, `ring-1 ring-primary/30`, `bg-primary/5`.
- Botones primarios (`Reservar`, `Continuar`, `Confirmar`, etc.): siguen usando `bg-primary` — heredarán el color configurado vía override.
- Slots de hora (`HorarioStep`, `FechaHorarioStep`): seleccionado → `bg-primary text-primary-foreground`; libre → `bg-card border-border`; hover → `bg-muted`.
- `Progress` ya usa `bg-primary`; queda automático.
- Badges de paso del stepper: variante `secondary` con texto `text-foreground` y borde sutil. Cuando representan paso activo → `border-primary text-primary bg-primary/5`.
- Confirmación final: ícono check con `bg-primary/10 text-primary` (ya hereda).

### 5. Tipografía y jerarquía

- H1 del portal: `text-2xl font-semibold tracking-tight`.
- Subtítulos de paso: `text-sm font-medium text-foreground` con `text-xs text-muted-foreground` debajo como ayuda.
- Labels de formulario: `text-xs font-medium text-muted-foreground uppercase tracking-wide` para diferenciar de valores.
- Spacing: pasar a `space-y-5`/`gap-4` consistente, padding interno de cards `p-5 sm:p-6`.

### 6. Tokens / superficies

Aplicados solo dentro del wrapper del portal (no globales) vía CSS-in-JS o clases utilitarias condicionales:

- `--portal-bg`: `bg-muted` (fondo gris suave) — base de la página.
- Card principal: `bg-card`, `border border-border/60`, `shadow-[0_1px_2px_rgba(0,0,0,0.04),0_8px_24px_-12px_rgba(0,0,0,0.08)]`, `rounded-2xl`.
- Subcards (resumen, slots, etc.): `bg-muted/50`, `border border-border/50`, `rounded-xl`.

## Detalles técnicos

- **Conversión HEX→HSL**: parseo simple a `r,g,b` en [0,1] y fórmula HSL estándar; retorna `"222 84% 58%"` etc. Esto permite que **todas** las clases shadcn (`bg-primary`, `text-primary`, `border-primary`, `ring-primary`) reflejen el color configurado, en cualquier paso. Eso resuelve el bug actual donde solo la landing usaba el color.
- También se setea `--ring` al mismo HSL para focus states.
- Se mantiene `--portal-primary` (hex puro) para usos donde el `Button` tiene `style={{ backgroundColor: 'var(--portal-primary)' }}` ya existente en `BookingLanding`.
- Si `primary_color` es `null` o inválido, el wrapper no aplica overrides → se usa el `--primary` por defecto del theme.
- El wrapper define los overrides también para dark mode si llegara a aplicarse (no obligatorio: el portal no toggle theme).

## Archivos afectados

- `src/pages/Reservar.tsx` — layout (grid + sidebar), wrapper de tema, fondo gris.
- `src/components/reservar/lib/portalTheme.ts` — nuevo (hex→hsl, build de style).
- `src/components/reservar/BookingSummary.tsx` — nuevo (sidebar de resumen).
- `src/components/reservar/BookingStepper.tsx` — clases visuales (tira de chips, progress, confirmación). Sin cambios de lógica de estados.
- `src/components/reservar/SucursalStep.tsx`, `ServicioStep.tsx`, `BarberoStep.tsx`, `FechaHorarioStep.tsx`, `HorarioStep.tsx`, `AuthStep.tsx`, `ConfirmacionStep.tsx`, `MisTurnosStep.tsx`, `RescheduleFlow.tsx`, `FechaStep.tsx` — solo ajustes de clases (cards, subcards, estados activos, jerarquía).
- `src/components/reservar/BookingLanding.tsx` — alinear con el nuevo layout (la card principal y el fondo ahora vienen del wrapper). Se mantiene la lógica existente de `--portal-primary`.

## Fuera de alcance

- No se modifica `usePortalConfig`, ni la edición del color en el panel admin, ni `get-org-public`, ni la auth de clientes, ni la lógica de disponibilidad/turnos.
- No se cambia el tema global de la app (la sobrescritura vive solo dentro del portal público).
- No se introducen librerías nuevas.

## QA

1. Organización sin `primary_color` → portal usa el primary por defecto, layout nuevo, sidebar de resumen visible en `lg+`.
2. Organización con `primary_color = #FF5722` → landing, progress, botones principales, slot seleccionado, badges activos, ícono de confirmación final, focus rings: todos en naranja.
3. Cambiar de paso: el sidebar de resumen se actualiza con cada selección.
4. Mobile (<1024px): sidebar oculto, chips de resumen en la parte superior, todo legible y sin overflow.
5. Modo "Manage": misma capa visual; auth + lista de turnos heredan tokens.
6. Volver a otras rutas (`/login`, `/app/...`): el theme override del portal NO contamina el resto.
7. Confirmación final: card de detalle con la nueva estética y check con color de marca.
