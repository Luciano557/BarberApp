# CRITERIOS DE DISEÑO — Fase 1: Sistema de diseño (inventario y diagnóstico)

> **Fecha:** 2026-07-07 · **Alcance:** relevamiento del estado ACTUAL, sin soluciones.
> Base para las fases 2 (transiciones), 3 (formularios) y 4 (módulos).
> La paleta de color final está pendiente de definición con el socio de negocio —
> acá solo se documenta cómo se usa el color hoy.

**Nota de contexto:** la app fuerza light mode (`src/main.tsx:5-16` remueve la clase
`dark`). Todos los tokens tienen variante dark definida en `src/index.css:111-190`,
pero hoy es código sin efecto visible.

---

## 1. Inventario de tokens

Fuente de verdad: `src/index.css` (definiciones HSL) + `tailwind.config.ts` (mapeo a clases).

### 1.1 Color

| Grupo | Definición | Mapeo Tailwind | Estado real |
|---|---|---|---|
| Escala `--color-50…950` (indigo Vittro) | `index.css:14-24` | **No mapeada** | Casi muerta: 1 solo uso, vía arbitrary value (`AppSidebar.tsx:208` scrim mobile `bg-[hsl(var(--color-950))]/50`) |
| Semánticos base (`background`, `foreground`, `card`, `popover`, `primary`, `secondary`, `muted`, `accent`, `destructive`, `success`, `border`, `input`, `ring`) | `index.css:27-80` | `tailwind.config.ts:16-53` | **Vivos y respetados** en la mayoría de la app interna |
| Status (`warning/success/info/error/purple/indigo`, cada uno con `-foreground` y `-bg`) | `index.css:54-76` | `tailwind.config.ts:64-94` | Vivos. **Excepción:** `--status-indigo-bg` existe pero no está mapeado (`tailwind.config.ts:90-93` omite `bg`); hoy nadie lo usa, así que no rompe nada |
| Sidebar (`--sidebar-*`) | `index.css:85-93` | `tailwind.config.ts:54-63` | Vivos. `--sidebar` (línea 93 y 176) está duplicado respecto de `--sidebar-background` y no lo consume nadie |
| Chart `--chart-1…5` | `index.css:96-100` | **No mapeados** | **Muertos**: 0 usos en código |
| Chart `--chart-cash/mp/cost/orange/amber/purple/indigo` | **NO DEFINIDOS en ningún CSS** | `tailwind.config.ts:95-101` | 🔴 **ROTOS**: usados 24 veces en `EstadisticasPanel.tsx` (líneas 79-88, 589-682, 914, 1058) como `hsl(var(--chart-cash))` etc. La variable no existe → el `hsl()` es inválido y el color cae al heredado/default. Los gráficos y acentos de Estadísticas no muestran el color que el código pretende |
| `--portal-primary` | Inyectado en runtime por `src/components/reservar/lib/portalTheme.ts:58` | No aplica | Mecanismo aparte para el portal público: el color lo elige el dueño (dato de usuario). Consumido inline en `BookingLanding.tsx:170,181` |

**Trampa vigente ya conocida:** `--secondary` en light es casi blanco (`231 80% 95%`),
no sirve para texto. Hoy no hay ningún `text-secondary` en el código (verificado) —
la corrección de junio 2025 se sostiene.

### 1.2 Tipografía

- `--font-sans` define Inter (`index.css:107`) y la línea 1 importa Inter desde
  Google Fonts (render-blocking).
- **Pero `tailwind.config.ts` no extiende `fontFamily`**, y el único punto de
  aplicación es `body { @apply font-sans }` (`index.css:203`), que resuelve a la
  pila *default de Tailwind* (`ui-sans-serif, system-ui, …`), que **no incluye Inter**.
- 🔴 Conclusión (por análisis estático; conviene confirmarlo una vez en el
  navegador): **Inter se descarga pero no se aplica**. La app se renderiza en la
  fuente del sistema (Segoe UI en Windows). `App.css` está vacío y no hay ningún
  otro `font-family` en `src/`.
- No hay escala tipográfica propia: se usan los tamaños default de Tailwind.
  Práctica observada:
  - Título de página: `text-2xl font-semibold` (`PageHeader.tsx:20`) **vs**
    `text-2xl font-bold` en los paneles no migrados (`EstadisticasPanel.tsx:924`,
    `GastosPanel.tsx:194`, `SueldosPanel.tsx:930`).
  - Título de card/sección: `text-lg font-medium` (`card.tsx:19`) vs
    `text-lg font-semibold` (DialogTitle, DrawerForm, SheetTitle).
  - Microtexto: `text-[10px]` (pills, badges), `text-[15px]` (`AppSidebar.tsx:248`).

### 1.3 Espaciado

- No hay tokens de spacing propios; se usa la escala default de Tailwind y en
  general se respeta.
- Hay **125 valores arbitrarios `[Npx]` en 40 archivos** de `src/components`
  (anchos de columnas, alturas puntuales, offsets). Concentración mayor:
  `ImportPreviewStep.tsx` (12), `AppSidebar.tsx` (12), `PaymentRegistration.tsx` (11),
  `NotificationsBell.tsx` (11). No es un problema sistémico, pero no hay criterio
  escrito de cuándo un arbitrary es aceptable.

### 1.4 Radios

- `--radius: 0.5rem` mapeado a `rounded-lg` (8px) / `md` (6px) / `sm` (4px)
  (`tailwind.config.ts:103-107`). Button usa `rounded-lg` (`button.tsx:8`).
- Fuera del token:
  - `rounded-xl` (12px, default Tailwind, **no** derivado del token): `card.tsx:6`,
    `dialog.tsx:43` → todas las cards y dialogs.
  - `rounded-[10px]` ×13: logo-tile y nav del sidebar (`AppSidebar.tsx:126,136,235,244`),
    `PageHeader.tsx:16`, `SubscriptionGate.tsx:144`, `Login.tsx:400,422`,
    `AuthCallback.tsx:184,191,217`. Es un radio "de marca" de facto que no existe
    como token.
  - `rounded-2xl` (overlay de éxito `PaymentRegistration.tsx:1632`), `rounded-[2rem]`
    (`PortalPreview.tsx:13`), `rounded-[2px]` (`chart.tsx:185,262`).
- `SegmentedControl.tsx:28,46` es el único que deriva del token con
  `rounded-[calc(var(--radius)-2px)]`.

### 1.5 Sombras

- `--shadow-sm/md/lg` definidos (`index.css:102-105`, dark `184-186`) pero
  **jamás consumidos**: no están mapeados en Tailwind ni se usan vía `var()`.
  **Tokens muertos.**
- Lo que se usa en la práctica es la escala **default de Tailwind**
  (`shadow-sm/md/lg/xl/2xl`): 69 usos en 42 archivos. Detalle en la sección 3.
- Sombras arbitrarias (5): la misma sombra custom duplicada en `Reservar.tsx:75`
  y `BookingStepper.tsx:42`; anillo de foco verde duplicado en
  `SucursalSelector.tsx:36,69`; `sidebar.tsx:421` (shadcn).

### 1.6 Motion (referencia para Fase 2)

Existe un mini-sistema coherente en `index.css:208-359`: `--ease-out-quint`
compartido, familia de keyframes (`item-in`, `pop-in`, `value-change`, `step-in-*`,
`overlay-*`, `confirm-*`, `payment-card-in`) y cobertura de
`prefers-reduced-motion` (`index.css:362-381`). No se audita acá.

### 1.7 Hex hardcodeados (93 ocurrencias en 16 archivos `.ts/.tsx`)

**Legítimos como datos de usuario** (excepción documentada del sistema): ~62

| Qué | Dónde | Cant. |
|---|---|---|
| `MARCA_COLORS` | `productos/types.ts:55-66` | 12 |
| Paleta portal público | `config/PortalColorPalette.tsx:10-19` | 10 |
| `LINE_COLORS` | **triplicado**: `LinesConfig.tsx:32-39`, `LineQuickEditPopover.tsx:21-28`, `ServicesConfig.tsx:96-103` | 24 |
| Colores auto-asignados de barberos | `agenda/hooks/useBarberColors.ts:5-12` | 8 |
| Inputs de color del portal (`#000000` fallback/placeholder) | `PortalPublicoSection.tsx:364,371` | 2 |
| `#fff` sobre color de dato | `BookingLanding.tsx:170`, `PortalColorPalette.tsx:49`, agenda `boxShadow '0 0 0 2px #fff'` (`AgendaDayView.tsx:557`, `AgendaMultiDayView.tsx:225`) | 4+ |

`LINE_COLORS` triplicado es duplicación de código (mismos 8 valores copiados 3 veces),
no de criterio. `useBarberColors` es zona gris: no lo elige el usuario, lo asigna la
UI — hoy funciona como dato, pero es una decisión abierta (ver sección 5).

**Violaciones (hex de UI que deberían ser token):** ~31

| Qué | Dónde | Observación |
|---|---|---|
| `#F4F5F7` hover ×3, `#EEEFF2` borde ×3, `#C39A45` badge PREMIUM | `AppSidebar.tsx:129,139,215,253,276,308,317` | `#F4F5F7` ≈ `--muted`, `#EEEFF2` ≈ `--border`; el dorado premium no existe en ningún token |
| CSS inline de auth (slate: `#e2e8f0`, `#f8fafc`, `#cbd5e1`, `#0f172a`, `#94a3b8`, `#64748b`, `#475569`; hover `#2a3a60` ×2; `#ea580c`, `#dc2626`) | `Login.tsx:187-232`, `VerifyEmail.tsx:134-159`, `AuthCallback.tsx:172,206` | Las páginas de auth tienen su propio micro-sistema en `<style>` inline. `#2a3a60` es el navy `--primary` oscurecido a mano (≈ `primary/90`) |
| Marketing Homepage (`#ebebea`, semáforo macOS `#ff5f57/#febc2e/#28c840`, gradiente `#3a5298` ×2) | `Homepage.tsx:263-267,332,694` | Decorativo de landing; queda fuera del sistema de la app, pero `#3a5298` repite el rol de "primary claro" sin token |

### 1.8 Clases Tailwind de color directas (violación de la regla "tokens para estados")

161 ocurrencias en 18 archivos, pero **138 están en pages de auth/marketing**
(`Homepage.tsx` 96, `Login.tsx` 25, `VerifyEmail.tsx` 9, `AuthCallback.tsx` 8).
Dentro de la app: **23 ocurrencias en 14 archivos**:

| Patrón | Archivos | Cant. |
|---|---|---|
| Botón "Activar" `bg-green-50 text-green-600 hover:bg-green-100 dark:…` | `ServicesConfig.tsx:368`, `LinesConfig.tsx:359`, `ExtrasConfig.tsx:241`, `DiscountsConfig.tsx:453`, `ProductosGlobalConfig.tsx:275`, `ProductoListItem.tsx:154` | 6 (mismo string copiado) |
| Import de clientes con **emerald**/amber (ni siquiera el mismo green) | `ImportSummaryStep.tsx:14-15`, `ImportPreviewStep.tsx:308-320`, `MergeDuplicatesDialog.tsx:115` | 6 |
| Estados MP Point `text-green-600` / `text-amber-600` | `MpTerminalPaymentDialog.tsx:59-75` | 4 |
| Alerta stock `amber-500/10 … amber-700` | `ProductoPickerDialog.tsx:294-296` | 3 |
| Otros: `text-green-600` estado activo (`ProductoListItem.tsx:174`), `text-green-600` (`MercadoPagoConnect.tsx:70`), `text-amber-500` (`TurnoConflictDialog.tsx:40`), `red-*` en close de toast destructivo (`toast.tsx:70`, default shadcn) | — | 4 |

---

## 2. Inventario de componentes compartidos

### 2.1 Componentes propios

| Componente | Archivo | Props / variantes | Usos | Estado |
|---|---|---|---|---|
| **DrawerForm** | `ui/drawer-form.tsx` | `size: "sm"(380px) \| "md"(520px) \| "lg"(680px)`; header fijo + body scroll + footer slot | 20 | Consistente. ⚠️ `lg` es nuevo y no está documentado en el skill/criterios (usos: `CashClosingHistory.tsx:144`, `MultiDayClosingSummary.tsx:124`). El footer es slot libre → la divergencia vive en los callers (botón "Activar" hardcodeado ×6, §1.8) |
| **CatalogSectionCard** | `ui/CatalogSectionCard.tsx` | `icon, title, description?, actions?, headerAlign?, search?, tabs?` | 9 (Services, Lines, Extras, Discounts, ProductosConfig, ProductosGlobal, EquipoUnificado, EquipoSucursalPanel, TareasConfig) | Consistente; es el contenedor canónico de secciones de catálogo |
| **SegmentedControl** | `ui/SegmentedControl.tsx` | `options[{value,label,count?}]`; pill deslizante navy; contador integrado | 10 | Consistente internamente. ⚠️ Compite con `Tabs pill + TabBadge` (ver 2.3) |
| **StatusPill** | `ui/StatusPill.tsx` | `status: success\|neutral\|info\|warning\|error`, `icon?\|false`, `size: sm\|md` | ~26 | El más sano: 100% tokens `--status-*` |
| **TagPill** | `ui/TagPill.tsx` | solo `label` — estilo fijo azul info | 4 | Consistente |
| **Badge** | `ui/badge.tsx` | `default\|secondary\|destructive\|outline\|category` + `size`, `color` | varios | ⚠️ La variante `category` tiene un solo color (`default`) — API vestigial: `color?: CategoryColor` con un único valor posible |
| **TabBadge** | `ui/TabBadge.tsx` | `count`; estado activo vía `group-data-[state=active]` | 3 pantallas (StaffConfig:197-198, TareasPanel:490-495, MarcasManagerDialog:200-203) | Consistente, pero ver duplicación 2.3 |
| **EntityColorBar** | `ui/EntityColorBar.tsx` | `color` (dato), `size: sm\|default`; responsive horizontal→vertical | 8 | Consistente |
| **ShowMoreDivider** | `ui/ShowMoreDivider.tsx` | `count, expanded?, label?` | 6 | ⚠️ `label` defaultea a `'miembros más'` — default específico de Equipo en un componente genérico; todos los demás callers deben pisarlo |
| **SelectableCard** | `ui/SelectableCard.tsx` | `selected, number?, disabled` | 6, todos en `PaymentRegistration.tsx` (stepper Cobrar) | Consistente pero mono-consumidor |
| **PageHeader** | `ui/PageHeader.tsx` | `title, subtitle, actions?, actionsLayout` — logo tile navy + h1 | 9 (Config, DailySummary, MiNegocio, Clientes, Finanzas ×2, PaymentRegistration, Tareas, TurnosAgenda) | 🆕 **Sin commitear** (reemplazó a `AppPanelHeader`, borrado sin referencias residuales). Migración **incompleta**: ver 2.4. ⚠️ Acopla layout: `pl-14 sm:pl-0` (línea 13) existe para esquivar el botón hamburguesa fijo del sidebar mobile (`AppSidebar.tsx:197`) — dependencia implícita no documentada |
| **EditableSectionHeader** | `ui/EditableSectionHeader.tsx` | título + Editar/Guardar/Cancelar | 5 (ClienteDetailDialog ×3, AppointmentDetailDialog ×2) | Consistente |
| **InitialsAvatar** | `ui/InitialsAvatar.tsx` | `name, size: sm\|md` | 1 (`AppointmentDetailDialog.tsx:513`) | Casi sin adopción |

### 2.2 Bases shadcn customizadas (desvíos del default relevantes)

- `button.tsx:8` — `rounded-lg` (vs `rounded-md` shadcn), `active:scale-[0.97]`,
  `duration-150 ease-out`. Customización deliberada y consistente.
- `tabs.tsx` — reescrito con **variantes `pill` y `underline`** (no existe en shadcn).
  `underline` es el estándar de tabs de nivel página (Finanzas, MiNegocio, Turnos, Tareas).
- `dialog.tsx:43` — `rounded-xl`, `bg-card`.
- `badge.tsx` — variante `category` agregada (hoy vestigial).
- `card.tsx:19` — `CardTitle` bajado a `text-lg font-medium`.
- El resto (`popover`, `dropdown-menu`, `select`, `toast`, `tooltip`, `sheet`, …)
  está prácticamente en default shadcn (incluye sus z-50 y sombras).

### 2.3 Duplicación detectada (mismo elemento, código distinto)

1. **"Tabs con contador" tiene dos implementaciones:**
   `SegmentedControl` con `count` (ServicesConfig, LinesConfig, ExtrasConfig,
   DiscountsConfig, ProductosConfig, ProductosGlobal, EquipoUnificado,
   EquipoSucursalPanel, AgendaManagement, CobrarConfig, MiNegocioGeneralTab) **vs**
   `TabsList pill + TabBadge` (StaffConfig:196, MarcasManagerDialog:198,
   TareasPanel:486 con underline). Visualmente son dos controles distintos para el
   mismo trabajo.
2. **El pill de `TabsList` se re-estiliza ad-hoc en cada uso** — 4 aspectos
   distintos del mismo control:
   - default `h-10 rounded-lg bg-muted p-1` (`ProductoDialog.tsx:256`, `BackfillWizard.tsx:382`)
   - `h-9 bg-muted p-1 rounded-lg` (`AgendaManagement.tsx:61`, `HorariosTrabajoSection.tsx:585`, `NegocioConfig.tsx:18` con h-10)
   - `h-9 bg-muted/50 p-1 rounded-md` (`MarcasManagerDialog.tsx:198`, `StaffConfig.tsx:196`, `RecurrentesPanel.tsx:130`)
   - `h-8 p-0.5` (`NotificationsBell.tsx:393`)
3. **Header de página**: `PageHeader` vs `<h1/h2 class="text-2xl font-bold">` manual
   (ver 2.4).
4. **Kebab de fila**: el trigger canónico (`h-7 w-7 … border-[0.5px] border-border`)
   aparece en 10 archivos / 11 usos, pero `SucursalTabContent.tsx:281-284` usa un
   `Button` `h-8 w-8` con `MoreVertical` que **no abre menú** (va directo a editar):
   parece kebab pero no lo es.
5. **`LINE_COLORS` triplicado** (§1.7) — mismos 8 hex copiados en 3 archivos.
6. **Sombra custom del portal de reservas duplicada** literal en `Reservar.tsx:75`
   y `BookingStepper.tsx:42`.

### 2.4 Migración PageHeader incompleta (visible al usuario)

`FinanzasPanel` renderiza `PageHeader "Finanzas"` (`FinanzasPanel.tsx:83,131`) y
adentro de sus tabs cada sub-panel repite su propio título de página con otro peso:

- `EstadisticasPanel.tsx:924,943` — `<h1 class="text-2xl font-bold">Estadísticas</h1>`
- `SueldosPanel.tsx:930` — `<h2 class="text-2xl font-bold">Sueldos</h2>`
- `GastosPanel.tsx:194` — `<h2 class="text-2xl font-bold">Gastos</h2>`

Resultado: **doble título en la misma vista** (h1 "Finanzas" + h1/h2 del tab),
mezcla `semibold`/`bold` y mezcla h1/h2. Es el desvío de componentes más visible hoy.

---

## 3. Uso de profundidad (sombras + z-index) por sección

### 3.1 Sombras — jerarquía de facto

Existe una jerarquía implícita heredada de shadcn, **no escrita en ningún lado**,
y con los tokens `--shadow-*` muertos en paralelo (§1.5):

| Nivel | Clase | Dónde |
|---|---|---|
| Reposo | `shadow-sm` | `card.tsx:6` (todas las cards), tab pill activo (`tabs.tsx:36`), thumb de `SegmentedControl:28`, turnos de agenda en hover |
| Flotante | `shadow-md` | `popover:20`, `dropdown-menu:64`, `select:69`, `tooltip:20`, `hover-card:19`, `context-menu`, `menubar` |
| Modal | `shadow-lg` | `dialog:43`, `alert-dialog:37`, `sheet:32`, `drawer-form:25`, `command:29`, `toast:26`, `sonner:13` |

**Desvíos del patrón:**

- `dropdown-menu.tsx:47` — el **SubContent** usa `shadow-lg` mientras el Content usa
  `shadow-md`: el submenú tiene más sombra que su menú padre.
- `switch.tsx:20` — el thumb del switch usa `shadow-lg` (nivel modal en un control de 16px).
- `chart.tsx:157` — tooltip de gráficos con `shadow-xl` (más que un modal).
- `OnboardingTooltip.tsx:59,144` — `shadow-2xl`.
- Cards de métricas con `shadow-md` donde el resto de las cards usa `shadow-sm`:
  `EstadisticasPanel.tsx:711,969,1036`, `DailySummary.tsx:537`.
- Portal de reservas: sombra custom propia (`Reservar.tsx:75`, `BookingStepper.tsx:42`)
  en vez de la escala — duplicada literal.
- `SucursalSelector.tsx:36,69` — "anillo" verde simulado con
  `shadow-[0_0_0_3px_hsl(var(--status-success)/0.25)]` ×2 (en vez de `ring-*`).
- `PortalCoverPositionDialog.tsx:232,248` — `shadow-lg` + `shadow-xl` internos.

### 3.2 z-index — mapa completo

**Agenda** (`src/components/agenda`) — stack de facto, coherente y escalonado.
⚠️ *No encontré un documento escrito del stack* (se lo buscó en comentarios y en
`.md` del repo); los valores viven en el código:

```
z-[5]   línea de "ahora"            AgendaDayView.tsx:581
z-[15]  marcas/guías               AgendaDayView.tsx:478,493
z-20    tarjetas de turno          AgendaDayView.tsx:521, AgendaMultiDayView.tsx:187
z-[25]  turno en hover             AgendaDayView.tsx:521
z-30    overlay "cerrado"/rótulos  AgendaDayView.tsx:481,590, AgendaMultiDayView.tsx:245
z-40    header sticky de columnas  AgendaDayView.tsx:369, AgendaMultiDayView.tsx:88
z-[100] ghost de drag (fixed)      AgendaDayView.tsx:604
```

**Resto de la app** — bandas de facto:

| Banda | Uso | Dónde |
|---|---|---|
| `z-0/10/20` | Capas locales (hero del portal, sticky menores) | `BookingLanding.tsx:91-102`, `SucursalTabContent.tsx:223`, `MiNegocioGeneralTabContent.tsx:110`, `NotificationsBell.tsx:392`, sidebar desktop `AppSidebar.tsx:218` |
| `z-40` | Botón hamburguesa fijo + scrim del sidebar mobile; header sticky de agenda; sticky de notificaciones | `AppSidebar.tsx:197,208`, `NotificationsBell.tsx:349` |
| `z-50` | **Todos** los overlays Radix (dialog, alert, sheet, drawer-form, popover, dropdown, select, tooltip, menubar, context, hover-card, navigation) + sidebar mobile + overlay de éxito de cobro | shadcn defaults; `AppSidebar.tsx:217`; `PaymentRegistration.tsx:1625` |
| `z-[60]/[61]` | Onboarding overlay | `OnboardingOverlay.tsx:21,24,38` |
| `z-[70]` | Onboarding tooltip | `OnboardingTooltip.tsx:58,141` |
| `z-[100]` | Toast viewport / drag ghost de agenda | `toast.tsx:17` / `AgendaDayView.tsx:604` |

**Riesgos observados (hoy no explotan, pero nadie los gobierna):**

1. **Empate en z-50**: el sidebar mobile (`aside` fijo, `AppSidebar.tsx:217`) empata
   con todos los overlays Radix. Hoy Radix portalea al final de `<body>` y gana por
   orden de DOM, pero es un empate resuelto por accidente, no por regla.
2. **Empate en z-[100]**: un toast y el ghost de drag de agenda comparten capa;
   si coinciden, decide el orden de DOM.
3. El onboarding (60/70) queda **debajo** de los toasts (100) — probablemente
   correcto, pero es implícito.
4. Fuera de agenda, ninguna pantalla necesita stack propio: la superposición se
   resuelve con el z-50 plano de Radix. No se encontraron conflictos activos.

---

## 4. Inconsistencias encontradas (priorizadas)

**P1 — Bugs o desvíos visibles en pantallas de valor**

| # | Qué | Alcance | Visibilidad |
|---|---|---|---|
| 1 | Tokens `--chart-*` usados y nunca definidos → colores rotos en Estadísticas | 24 usos, `EstadisticasPanel.tsx` + `tailwind.config.ts:95-101` | Alta: los gráficos del panel financiero no muestran los colores que el código intenta |
| 2 | Inter importada pero (según análisis estático) no aplicada — la app corre en fuente de sistema y paga la descarga igual | Toda la app (`index.css:1,107,203` + `tailwind.config.ts` sin `fontFamily`) | Alta pero silenciosa: afecta el 100% de la tipografía. Confirmar una vez en navegador |
| 3 | Doble título de página en Finanzas (PageHeader + h1/h2 `bold` dentro del tab) | `FinanzasPanel` + `EstadisticasPanel:924`, `SueldosPanel:930`, `GastosPanel:194` | Alta: se ve en cada visita a Finanzas |

**P2 — Inconsistencias repetidas de sistema**

| # | Qué | Repeticiones | Visibilidad |
|---|---|---|---|
| 4 | Botón "Activar" con verde Tailwind hardcodeado en vez de `--status-success` | 6 archivos (mismo string) | Media: solo en drawers de edición de entidades inactivas |
| 5 | Dos sistemas de "tabs con contador" (SegmentedControl vs Tabs pill+TabBadge) + 4 estilos distintos del pill de TabsList | ~14 pantallas | Media-alta: se nota al navegar entre secciones |
| 6 | Import de clientes usa `emerald`/`amber` directos (tercer verde distinto en la app) | 6 usos, 3 archivos | Media: flujo de importación |
| 7 | `LINE_COLORS` triplicado | 3 archivos × 8 valores | Nula para el usuario; riesgo de divergencia al editar |
| 8 | AppSidebar con hex propios (`#F4F5F7`≈muted, `#EEEFF2`≈border, `#C39A45` premium sin token) | 7 usos | Baja visual (hoy casi coinciden con los tokens), alta conceptual: el sidebar quedaría desincronizado ante cualquier cambio de paleta |
| 9 | Páginas de auth (Login/VerifyEmail/AuthCallback) con micro-sistema CSS inline propio (slate + `#2a3a60`) | ~20 hex | Media: primera pantalla que ve todo usuario nuevo |
| 10 | `Dialog` centrado para "Nueva sucursal" en vez de DrawerForm (vigente, `MiNegocioPanel.tsx:522`) | 1 | Media |

**P3 — Deuda menor / higiene**

| # | Qué |
|---|---|
| 11 | Tokens muertos: `--shadow-sm/md/lg`, `--chart-1…5`, `--color-50…950` (1 uso), `--status-indigo-bg` sin mapear, `--sidebar` duplicado |
| 12 | `dropdown-menu` SubContent con más sombra que su Content (`:47` vs `:64`) |
| 13 | Thumb de `switch` con `shadow-lg` |
| 14 | `rounded-[10px]` ×13 sin token (radio "de marca" de facto) |
| 15 | Sombra custom del portal duplicada ×2; anillo verde `SucursalSelector` ×2 |
| 16 | Falso kebab en `SucursalTabContent.tsx:284` (h-8 w-8, sin DropdownMenu) |
| 17 | Empates z-50 (sidebar mobile vs Radix) y z-[100] (toast vs drag ghost) resueltos por orden de DOM |
| 18 | `DrawerForm size="lg"` sin documentar en los criterios |
| 19 | `ShowMoreDivider` con default `'miembros más'` específico de Equipo |
| 20 | Estados con color directo en `MpTerminalPaymentDialog`, `MercadoPagoConnect:70`, `TurnoConflictDialog:40`, `ProductoPickerDialog:294`, `ProductoListItem:174` |
| 21 | `Badge variant="category"` con API de color vestigial (1 solo valor) |
| 22 | Voseo pendiente conocido: tuteo en `LineQuickEditPopover:200` y `PinConfigSection:150,173,307` (relevado en auditoría previa; los archivos siguen existiendo) |

**Totales por categoría:** tokens **10** hallazgos (2 críticos) · componentes **9** · profundidad **6**.

---

## 5. Preguntas abiertas (necesitan decisión antes de fijar criterio)

1. **Paleta de color final** (pendiente con el socio) — bloquea: definición de los
   `--chart-*` faltantes (#1), la suerte de la escala `--color-*` casi muerta, la
   tokenización del dorado PREMIUM (`#C39A45`) y de los hex del sidebar.
2. **Tipografía**: ¿Inter es la fuente elegida? Si sí, hay que conectarla
   (fontFamily en Tailwind); si no, eliminar el `@import` y `--font-sans`. Hoy se
   paga el costo sin el beneficio.
3. **Colores de gráficos**: aunque se arregle el bug #1, ¿la paleta de charts se
   deriva de la paleta de marca o es independiente? Depende de la decisión 1.
4. **`useBarberColors`**: ¿los colores auto-asignados de barberos son "dato de
   usuario" (como LINE_COLORS, quedan hex) o son UI (deberían tokenizarse)?
5. **Tabs con contador**: ¿cuál es el canónico — `SegmentedControl` o
   `Tabs pill + TabBadge`? Hoy conviven y ninguno está declarado ganador.
6. **Elevación**: ¿se formaliza la escala de facto (sm=reposo, md=flotante,
   lg=modal) y se eliminan los tokens `--shadow-*` muertos, o se conectan esos
   tokens a Tailwind? (Los valores custom son más suaves que los default.)
7. **z-index**: ¿se documenta un stack global por bandas (0-20 local / 40 sticky y
   chrome / 50 overlays / 60-70 onboarding / 100 toasts+drag) y se desempatan
   sidebar-mobile y drag-ghost?
8. **Radio 10px**: ¿se promueve a token (es el radio de identidad del logo-tile y
   nav) o se normaliza a la escala `--radius`? Y ¿`rounded-xl` de cards/dialogs
   debería derivar del token?
9. **Páginas de auth y Homepage**: ¿entran al sistema de diseño (migrar su CSS
   inline a tokens) o se declaran explícitamente fuera del alcance del sistema?
10. **Dark mode**: los tokens dark existen completos pero `main.tsx` fuerza light.
    ¿Se mantienen actualizados "por si acaso" o se declara light-only y se deja de
    escribir variantes `dark:` (hoy se siguen copiando, ej. el botón Activar)?

---

## Decisiones tomadas (post Fase 1) — build 2026-07-08

Cierra 5 de las preguntas abiertas de la sección 5. La paleta de marca final
**sigue pendiente** — no se tocó.

- **Tipografía (pregunta 2):** Inter confirmada como fuente elegida y conectada
  de verdad. `tailwind.config.ts` ahora extiende `theme.extend.fontFamily.sans`
  con `Inter` primero y el mismo fallback que ya declaraba `--font-sans` en
  `src/index.css:107`— antes la clase `font-sans` resolvía al default de
  Tailwind y la fuente descargada no se aplicaba. Confirmar visualmente en
  navegador que el render cambió respecto de Segoe UI.
- **Colores de gráficos (preguntas 1 y 3):** se definieron los 7 tokens
  `--chart-cash/mp/cost/purple/indigo/orange/amber` en `src/index.css`
  (bloque `:root` y `.dark`), reusando los valores HSL de
  `--status-success/info/error/purple/indigo` para los primeros 5. Los 2
  restantes (`--chart-orange`, `--chart-amber`) son **provisorios** — no
  existían tokens semánticos equivalentes para reusar — y quedaron marcados
  inline con `/* PROVISIONAL: pendiente definición de paleta con socio */`.
  Los 24 usos existentes en `EstadisticasPanel.tsx` ahora resuelven a un color
  válido.
- **Finanzas — título duplicado:** se eliminó el título manual (`h1`/`h2` +
  ícono, y en Estadísticas también el subtítulo acoplado) de
  `EstadisticasPanel.tsx`, `SueldosPanel.tsx` y `GastosPanel.tsx`. `Wallet` y
  `Receipt` se sacaron de los imports de Sueldos/Gastos por quedar sin uso. En
  Estadísticas, el selector de período pasó a ser el único contenido de esa
  fila (alineado a la derecha); en Sueldos, los presets de período ocupan el
  lugar donde estaba el título.
- **Sombras — escala de 3 niveles formalizada:** reposo `shadow-sm` / flotante
  `shadow-md` / modal `shadow-lg` (la escala default de Tailwind, ya era la de
  facto). Se eliminaron los tokens `--shadow-sm/md/lg` de `src/index.css`
  (`:root` y `.dark`) por no tener ningún consumidor. Se corrigieron 6 de los 7
  desvíos detectados en la Fase 1: `dropdown-menu` SubContent (`shadow-lg` →
  `shadow-md`, igualado a su Content), thumb de `switch` (`shadow-lg` →
  `shadow-sm`), tooltip de `chart.tsx` (`shadow-xl` → `shadow-md`),
  `OnboardingTooltip` ×2 (`shadow-2xl` → `shadow-md`), card "Total General" de
  `DailySummary.tsx:537` (`shadow-md` → `shadow-sm`), sombra custom duplicada
  del portal de reservas en `Reservar.tsx` y `BookingStepper.tsx` (reemplazada
  por `shadow-sm`), y el anillo verde simulado de `SucursalSelector.tsx` ×2
  (`shadow-[0_0_0_3px_...]` → `ring-2 ring-status-success/25`).
  **No se tocaron** las 3 cards de métricas de `EstadisticasPanel.tsx`
  (antes referenciadas como desvío en Fase 1, líneas ~711/959/1026): son
  `hover:shadow-md` sobre `Card` clickeable con `transition-shadow` —el patrón
  correcto de elevación (reposo `shadow-sm` del `Card` base → hover
  `shadow-md`)—, no una sombra estática en reposo. Bajarlas a
  `hover:shadow-sm` habría anulado el efecto de hover. Ver nota de desvío en
  el reporte del build.
- **z-index — stack documentado y 2 desempates:** se agregó un comentario-bloque
  al inicio de `src/index.css` con el stack completo por bandas (0-20 local /
  40 chrome fijo y sticky / 50 overlays Radix / 60-70 onboarding / 80 drag
  ghost / 100 toast). Sidebar mobile (`AppSidebar.tsx`) bajó de `z-50` a
  `z-40` para dejar de empatar con los overlays de Radix. Ghost de drag de
  turnos en Agenda (`AgendaDayView.tsx`) bajó de `z-[100]` a `z-[80]` para
  quedar siempre debajo de un toast que llegue en simultáneo.
- **Alcance del sistema unificado:** Auth (`Login.tsx`, `VerifyEmail.tsx`,
  `AuthCallback.tsx`) y `Homepage.tsx` quedan **explícitamente fuera** del
  sistema de diseño unificado — mantienen su CSS/clases propias y no se migran
  en este ni en builds futuros salvo decisión explícita en contrario.

---

## Fase 2 — Transiciones (auditoría 2026-07-08)

> Inventario y diagnóstico puro, sin implementación. Auth y Homepage quedan
> fuera (decisión de Fase 1). Línea de referencia del registro producto:
> 150–250ms en la mayoría de las transiciones, motion que comunica estado
> (no decoración), sin coreografías de carga de página.

### F2.1 Inventario del sistema de motion

**Núcleo custom** (`src/index.css:230-403`): un easing token compartido
(`--ease-out-quint`, `index.css:124`) y 13 keyframes en tres familias, todas
sobre `opacity`/`transform` únicamente:

| Familia | Keyframes | Duración / easing | Consumidor |
|---|---|---|---|
| Genéricos | `fade-in` (232), `item-in` (248), `pop-in` (264), `value-change` (280) | 140–200ms · ⚠️ `fade-in` usa `ease-out` nativo, los otros 3 usan quint | Toda la app |
| Stepper Cobrar | `step-in-forward` / `step-in-back` (296/312) | 200ms quint | Solo `PaymentRegistration.tsx:910` |
| Éxito de cobro | `overlay-show/hide`, `confirm-card-in/out`, `confirm-icon-pop`, `confirm-text-in`, `payment-card-in` (326-380) | 220–380ms quint con delays 60–260ms · ⚠️ los exits usan `cubic-bezier(0.4,0,1,1)` ad-hoc | Solo `PaymentRegistration.tsx:1626-1643, 1316` |

Además: `accordion-down/up` en `tailwind.config.ts:113-134` (anima `height`).

**Dónde se usa cada uno:**

- `animate-fade-in` (17 usos): entrada de contenido al cambiar de tab —
  `ConfigurationPanel:68`, `DailySummary:473`, `MiNegocioPanel:385,428,467`,
  `MiNegocioGeneralTabContent:183,199,211`, `CobrarConfig:43,57`,
  `TurnosAgendaPanel:112`, `PaymentRegistration:828,1488,1493` — más scrim del
  sidebar mobile (`AppSidebar:208`), onboarding (overlay + tooltip ×2) y
  `NotificationsBell:349`.
- `animate-item-in` (8 usos): filas de listas de catálogo (`ServicesConfig:278`,
  `DiscountsConfig:274`, `ProductosConfig:206`, `ProductosGlobalConfig:242`,
  `EquipoUnificado:1221`), carrito de Cobrar (`PaymentRegistration:1013`) y nav
  del sidebar con stagger de 25ms/ítem (`AppSidebar:113-114`).
- `animate-pop-in` (2), `animate-value-change` (3), `step-in-*`,
  `payment-card-in` (stagger 60ms/card, inline en `PaymentRegistration:1316`)
  y la familia confirm/overlay: todos concentrados en Cobrar.

**Overlays base**: los 13 componentes Radix (`dialog`, `alert-dialog`, `sheet`,
`drawer-form`, `popover`, `dropdown-menu`, `select`, `tooltip`, `hover-card`,
`context-menu`, `menubar`, `navigation-menu`, `toast`) tienen entrada/salida vía
tailwindcss-animate (fade+zoom/slide, `opacity`/`transform` — baratas).
**Ninguno aparece "de golpe".** `ProductoPickerDialog:170` es el único que
overridea el timing del Dialog (180ms + quint vs 200ms default).

**Huecos — donde NO hay motion pudiendo haberlo (o el vecino lo tiene):**

1. **Tabs de sección**: el fade de entrada existe en ~6 secciones
   (Configuración, Resumen, Mi Negocio, Cobrar config, Turnos, Cobrar) y falta
   en FinanzasPanel, ClientesPanel, TareasPanel y los sub-paneles de Finanzas
   (Estadísticas/Sueldos/Gastos). Mitad y mitad.
2. **Listas de catálogo**: `LinesConfig` y `ExtrasConfig` no tienen
   `animate-item-in`; sus 5 hermanos de catálogo sí.
3. **`Collapsible` es instantáneo** (`ui/collapsible.tsx` re-exporta Radix sin
   animación) en los 8 archivos que lo usan (NuevoClienteDialog,
   EstadisticasPanel, CuentasSucursalConfig, MiNegocioGeneralTabContent,
   NotificationsBell, PortalPublicoSection, SucursalesInactivasCollapsible,
   SueldosPanel) — solo rota el chevron (`transition-transform 200ms`).
   Mientras tanto `Accordion` (mismo gesto, `PortalPublicoSection:231`) sí
   anima la altura. Misma interacción, dos comportamientos.
4. **Pasos del portal público**: cambian instantáneo
   (`BookingStepper.tsx:221+`, render condicional sin clases de animación);
   solo la pantalla de confirmación anima (`:159` y `RescheduleFlow:94`, con
   `animate-in fade-in zoom-in-95 duration-300` de tailwindcss-animate).
   📌 **Corrección a la premisa de esta fase**: el portal NO usa
   `payment-card-in` ni `step-in-*` — esos keyframes viven solo en Cobrar.
   El portal está en un sistema aparte: tailwindcss-animate ad-hoc + una
   animación de altura por JS (`BookingSummary.tsx:160`, sí usa quint).
5. **Hover/micro**: `Button` (scale 0.97 active + 150ms), filas de tabla
   (`table.tsx:37`), tabs, `SegmentedControl` y los pasos del portal tienen
   `transition-colors`; el trigger kebab canónico y los ítems de
   DropdownMenu cambian hover sin transición (instantáneo — aceptable para
   menús de uso frecuente, pero no está escrito como criterio).

### F2.2 Peso de cada animación

**Baratas (solo `transform`/`opacity` — compositor):** los 13 keyframes del
sistema custom, todos los overlays Radix/tailwindcss-animate, el slide del
sidebar mobile (`translate3d` + scrim), el thumb de `SegmentedControl`, el
`active:scale` de Button/SelectableCard, la rotación de chevrons y el drag de
turnos en Agenda (posiciona por `transform` sin transición).

**Caras (generan layout o paint):**

| # | Dónde | Propiedad que la hace cara | Frecuencia de uso |
|---|---|---|---|
| 1 | `AppSidebar.tsx:218` — colapso desktop `transition-[width]` 200ms | `width` (relayout de TODO el contenido principal en cada frame) | Alta: cada colapso/expansión |
| 2 | `MiNegocioGeneralTabContent.tsx:104` — banner "cargando" que se pliega | `max-height` + `padding` + `border` vía `transition-all` 300ms | Baja (una vez por carga) |
| 3 | `BookingSummary.tsx:160` — resumen chip↔full del portal | `height` animada por JS | Media: en cada paso del booking mobile |
| 4 | `OnboardingOverlay.tsx:24,38` — spotlight que persigue al target | `top/left/width/height` vía `transition-all` 300ms + `backdrop-blur` | Baja (solo onboarding) |
| 5 | `EquipoSucursalPanel.tsx:243` — highlight de card | `transition-shadow` **700ms** (paint + duración fuera de rango) | Baja |
| 6 | `accordion.tsx:43` + `tailwind.config.ts:113` | `height` | Baja (solo PortalPublicoSection) |
| 7 | `EstadisticasPanel.tsx:711,959,1026` — hover de cards de métricas | `transition-shadow` (paint, área chica) | Media (hover) |

**Riesgo latente:** `transition-all` en ~10 sitios más (`progress.tsx:16`,
`toast.tsx:26`, `input-otp.tsx:35`, `SelectableCard:31`,
`MarcasManagerDialog:126`, `accordion.tsx:25`, `sidebar.tsx:257`…). Hoy la
mayoría solo cambia colores o transform, pero `all` anima cualquier propiedad
futura sin avisar.

### F2.3 Estado real de los 3 frentes en pausa

**a. Sidebar (colapso/expansión)** — verificado en `AppSidebar.tsx`:
- Mobile: **resuelto y barato** — slide por `translate3d` 200ms quint (:217,
  :224) + scrim con `animate-fade-in` (:208).
- Desktop: el `aside` anima `transition-[width]` 200ms quint entre `w-56` y
  `w-16` (:218-219) — la transición cara #1. Todo lo demás conmuta
  **instantáneamente** al cruzar `railMode`: la zona del logo (tile+nombre+badge
  → tile centrado, :232-241), los labels del nav (icon+texto → icon solo,
  :133-178), los section labels ("Principal"/"Gestión" → divisor, :297-308),
  el footer de usuario (fila avatar+nombre+rol+campana → columna de íconos,
  :318-385) y el `SucursalSelector` (chip → glyph, :286-291).
- El chevron cambia de forma y posición sin transición: expandido es un botón
  navy full-width con `ChevronLeft` (:387-395); colapsado es un cuadrado 8×8
  con `ChevronRight` (:341-349).
- **Punto de decisión donde quedó**: cómo se comportan la zona del logo, la
  info de usuario y el chevron durante el colapso (hoy: salto instantáneo
  mientras el ancho anima). No hay TODO ni comentario en el código; el estado
  pausado solo se ve en ese contraste.

**b. Cobrar — etapa 2** — verificado en `PaymentRegistration.tsx`:
- La etapa 1 está **implementada y viva**: pasos con `step-in-forward/back` +
  key replay y dirección (:908-910), `value-change` en números (:1490-1516),
  `item-in` en carrito (:1013), `pop-in` en badges (:1169), `payment-card-in`
  con stagger en métodos de pago (:1316) y la secuencia completa de éxito
  (overlay + card + icon pop + texto, :1623-1649).
- De la etapa 2 ("transiciones más grandes") **no hay ningún rastro en código**:
  ni comentario, ni flag, ni keyframes sin usar. Estado: no arrancada; su
  definición vive fuera del repo.

**c. AppointmentDetailDialog — Stage 1** — verificado:
- **El build Stage 1 se aplicó.** El dialog tiene la estructura nueva: header
  con `InitialsAvatar` + nombre + `StatusPill` (:513-517), secciones con
  `EditableSectionHeader` para "Datos de contacto" (:523) y turno (:590),
  edición inline con alta de cliente embebida (:474-506) y flujo de
  confirmación de cancelación por estado (`confirmingCancel`).
- No tiene **ningún motion propio** (cero clases `animate-`/`transition` en el
  archivo) — hereda solo la entrada/salida del Dialog base. No hay rastro de
  un Stage 2.

### F2.4 Cobertura de prefers-reduced-motion

**Estado: casi completa.** La regla global (`index.css:384-403`) anula por
wildcard la duración de TODAS las animaciones y transiciones CSS — cubre el
sistema custom, tailwindcss-animate, y hasta los estilos inline (el
`!important` de la hoja gana sobre inline sin `!important`, incluido el
`payment-card-in` inline de `PaymentRegistration:1316` y la transición JS de
`BookingSummary:160`). La familia overlay/confirm tiene además override
explícito (`animation: none`), y `SelectableCard:32,35` usa `motion-reduce:`.

**Excepciones sin cubrir:**

1. **Recharts** (`EstadisticasPanel`): anima por JavaScript
   (requestAnimationFrame, no CSS) → la regla no lo alcanza. `isAnimationActive`
   no está seteado en ningún chart (verificado: 0 ocurrencias), así que las
   animaciones de barras/líneas corren siempre.
2. **Scroll suave por JS**: 7 `scrollIntoView({ behavior: 'smooth' })`
   (`MiNegocioGeneralTabContent:92`, `OnboardingProvider:99`,
   `EquipoSucursalPanel:86`, `SucursalTabContent:94,211`,
   `FechaHorarioStep:167`, `HorarioStep:70`) — es JS, la regla CSS no lo toca.
3. **`animation-delay` no se anula**: la regla reduce duración pero no delay.
   El stagger del sidebar (25ms/ítem con `fill-mode:backwards`,
   `AppSidebar:113-114`) y el de `payment-card-in` (60ms/card) mantienen la
   aparición escalonada — cada ítem queda invisible durante su delay aunque su
   animación dure 0.01ms. Menor, pero es movimiento residual.

### F2.5 Inconsistencias (priorizadas)

**P1 — Visible y molesto**

| # | Qué | Dónde |
|---|---|---|
| 1 | Colapso desktop del sidebar anima `width` (relayout global) con el contenido saltando instantáneo alrededor — es a la vez la transición más cara y el frente en pausa | `AppSidebar:218` |
| 2 | Portal público (el flujo con más usuarios externos): pasos sin transición + sistema de motion aparte (tailwindcss-animate ad-hoc + height por JS) del resto de la app | `BookingStepper`, `BookingSummary:160`, `RescheduleFlow:94` |
| 3 | Highlight de asignaciones con `transition-shadow` de **700ms** — se percibe como lag, no como feedback | `EquipoSucursalPanel:243` |

**P2 — Repetido / sistémico**

| # | Qué |
|---|---|
| 4 | Fade de entrada de tabs en ~6 de 9 secciones — mitad de la app "entra", la otra mitad aparece seca (Finanzas, Clientes, Tareas sin fade) |
| 5 | `item-in` ausente en `LinesConfig` y `ExtrasConfig` (sus 5 hermanos lo tienen) |
| 6 | `Collapsible` instantáneo (8 archivos) vs `Accordion` animado — mismo gesto, dos comportamientos |
| 7 | `fade-in` — el keyframe más usado (17) — es el único con `ease-out` nativo débil en vez de quint; los exits usan `cubic-bezier(0.4,0,1,1)` ad-hoc |
| 8 | Sin tabla canónica de duraciones: Sheet abre en **500ms** (`sheet.tsx:32`, sobre el techo de 300ms del registro producto), Dialog 200ms, ProductoPicker 180ms quint, DrawerForm 300/200ms quint — cada overlay con su número |
| 9 | Banner de carga con `max-height`+`transition-all` (`MiNegocioGeneralTabContent:104`) — patrón caro para algo que el resto resuelve con opacity |

**P3 — Higiene menor**

| # | Qué |
|---|---|
| 10 | `transition-all` latente en ~10 sitios donde bastaría `transition-colors`/`transform` |
| 11 | Recharts sin gate de reduced-motion ni `isAnimationActive` |
| 12 | `animation-delay` no anulado en reduced-motion (staggers residuales) |
| 13 | `scrollIntoView smooth` ×7 sin respetar reduced-motion |
| 14 | Hover instantáneo en kebab/menú items — probablemente correcto (uso frecuente) pero sin criterio escrito |
| 15 | `accordion-down/up` anima `height` (uso acotado a PortalPublicoSection) |

**Totales Fase 2:** 7 transiciones caras concretas + 1 clase de riesgo latente
(`transition-all`) · 15 inconsistencias (3 P1 / 6 P2 / 6 P3) · 3 excepciones de
reduced-motion.

### F2.6 Preguntas abiertas (para la fase de plan)

1. **Fade de tabs**: ¿es criterio para TODAS las secciones o se elimina? El
   registro producto dice "sin coreografías de carga"; hoy está mitad y mitad —
   cualquiera de las dos direcciones es defendible, pero hay que elegir una.
2. **Sidebar desktop**: la decisión de diseño pausada (logo / user info /
   chevron durante el colapso) y la técnica (¿se reemplaza `width` por una
   solución de compositor o se acepta el costo?) van juntas — destrabar una
   define la otra.
3. **Portal público**: ¿adopta el sistema custom (quint + step-in) para
   alinearse con Cobrar, o se mantiene en tailwindcss-animate? ¿Los pasos deben
   animar o el cambio seco es deliberado (velocidad percibida)?
4. **Tabla canónica de timing**: definir duraciones permitidas (ej.
   150/200/300ms) y curvas por rol (entrada quint / salida ¿cuál?) para matar
   los ad-hoc (Sheet 500ms, highlight 700ms, exits cubic-bezier sueltos).
5. **Collapsible vs Accordion**: ¿colapsables animados (y con qué técnica
   barata) o instantáneos en toda la app?
6. **Recharts**: ¿se desactivan las animaciones de charts (registro producto:
   un gráfico funcional está mejor sin animación) o solo se gatean por
   reduced-motion?
7. **Cobrar etapa 2**: ¿sigue vigente como objetivo después de cerrar el
   sidebar, y con qué alcance? Hoy no existe ni como esqueleto.

*Método F2: lectura de `src/index.css` (motion completo), `tailwind.config.ts`,
los 13 overlays base de `ui/`, `AppSidebar`, `PaymentRegistration`,
`AppointmentDetailDialog`, `BookingStepper`/`BookingSummary`/`RescheduleFlow` y
barridos ripgrep de `animate-*`, `transition-*`, `duration-*`, easings custom,
`scrollIntoView` e `isAnimationActive` sobre `src/` al 2026-07-08. Los 3
frentes en pausa se verificaron contra el código actual, no contra memoria.*

---

## Decisiones tomadas (post Fase 2) — build 2026-07-08

Cierra 4 de las 7 preguntas abiertas de la Fase 2. Portal público y sidebar de
escritorio **quedan fuera de este build** — tienen sesión propia pendiente.

- **Fade de entrada completado**: `animate-fade-in` en el contenedor de
  contenido de `FinanzasPanel.tsx` (ambas ramas), `ClientesPanel.tsx`,
  `TareasPanel.tsx` y en los 3 sub-paneles de Finanzas
  (`EstadisticasPanel.tsx`, `SueldosPanel.tsx`, `GastosPanel.tsx`, que animan
  su propio contenido cada vez que Radix remonta su `TabsContent` al cambiar
  de tab). `animate-item-in` agregado a `LinesConfig.tsx` (líneas activas —
  reordenables por `dnd-kit` — e inactivas) y `ExtrasConfig.tsx`, igualando a
  sus 5 hermanos de catálogo. Para las líneas activas se envolvió
  `SortableLineItem` en un `<div>` propio con la clase en vez de aplicarla al
  elemento que controla `dnd-kit`, para no pisar el `transform` que usa para
  el drag.
- **Tabla canónica de timing**: nuevo token `--ease-in-quint:
  cubic-bezier(0.4, 0, 1, 1)` en `src/index.css`, formalizando la curva que ya
  se usaba repetida como magic number. El keyframe `fade-in` pasó de
  `ease-out` nativo a `var(--ease-out-quint)` (ahora las 4 animaciones
  genéricas —fade-in/item-in/pop-in/value-change— comparten curva). Los exits
  de la familia overlay/confirm (`overlay-hide`, `confirm-card-out`) migraron
  su `cubic-bezier(0.4,0,1,1)` hardcodeado a `var(--ease-in-quint)` — mismo
  valor, ahora con nombre. `Sheet` bajó de 500ms a 300ms de entrada
  (`sheet.tsx`, igualado a `DrawerForm`); el highlight de asignación de
  `EquipoSucursalPanel.tsx` bajó de 700ms a 250ms. `ProductoPickerDialog`
  (180ms) no se tocó, según lo indicado.
- **Collapsible animado**: `CollapsibleContent` (`ui/collapsible.tsx`) ya no
  re-exporta el primitivo de Radix desnudo — ahora es un `forwardRef` que
  anima `height` vía `data-[state=open|closed]`, igual que `Accordion`. No
  pudo reutilizar literalmente los keyframes `accordion-down/up`: Radix
  Collapsible expone su propia variable de altura
  (`--radix-collapsible-content-height`, distinta de
  `--radix-accordion-content-height`), así que se agregaron
  `collapsible-down/up` equivalentes en `tailwind.config.ts` (mismo 0.2s
  `ease-out`, mismo tratamiento que Accordion). Afecta a los 8 consumidores
  sin tocarlos: heredan el comportamiento del componente base. Se confirmó
  que el `Collapsible` de `PortalPublicoSection.tsx` es este componente
  genérico (pantalla de configuración del portal, no el portal público en sí)
  — no se violó el candado del portal.
- **Recharts respeta reduced-motion**: nuevo hook
  `src/hooks/usePrefersReducedMotion.ts` (mismo patrón que `use-mobile.tsx`:
  `matchMedia` + listener de cambios). Aplicado con
  `isAnimationActive={!prefersReducedMotion}` en los 8 elementos `Bar`/`Line`
  de Recharts en `EstadisticasPanel.tsx`, repartidos en 3 componentes
  (`MetricChart`, `MetricDetailDialog`, el cuerpo principal del panel) — cada
  uno con su propia llamada al hook. En `MetricDetailDialog` el hook se ubicó
  antes del `if (!metric) return null;` para no violar las reglas de hooks.
- **Nota de alcance — Cobrar es intencional**: `step-in-forward/back`, la
  familia `overlay-show/hide` + `confirm-*` de la secuencia de éxito, y
  `payment-card-in` son decisiones de producto ya tomadas para el flujo de
  Cobrar, no una inconsistencia a resolver. Auditorías futuras no deben
  volver a marcarlas como hallazgo ni proponer "expandirlas" a otras
  pantallas sin decisión explícita.
- **Pendiente, fuera de este build**: portal público de reservas (sistema de
  motion aparte, sin tocar) y sidebar de escritorio (`transition-[width]` +
  todo lo que conmuta instantáneo alrededor) — ambos con sesión propia. Sin
  tocar tampoco: `transition-all` latente, `scrollIntoView smooth` y
  `animation-delay` de los staggers (no fueron decididos en esta fase).

---

*Método: lectura completa de `src/index.css`, `tailwind.config.ts` y los 16
componentes compartidos/base relevantes, más barridos con ripgrep sobre `src/` para
hex, clases de color directas, sombras, z-index, radios y valores arbitrarios. Los
conteos son de ocurrencias en código al 2026-07-07 (incluye cambios sin commitear:
`PageHeader.tsx` nuevo, `AppPanelHeader.tsx` borrado). Único punto no verificable
estáticamente: la fuente efectiva en runtime (#2), marcado como "confirmar en
navegador". No se detectaron componentes usados solo dinámicamente que impidieran
rastrear instancias.*
