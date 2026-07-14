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

> **Nota (sesión ícono contextual, 2026-07-13)**: `PageHeader` ahora requiere
> `icon` (prop obligatoria) — cualquier nuevo call site futuro debe
> especificar un ícono contextual, no hay default.

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
- **Nombres canónicos en `tailwind.config.ts`** (2026-07-10, sin cambio de
  valor — solo nomenclatura, resolviendo warnings de "clase ambigua" de
  Tailwind): `duration-sidebar-text` (120ms, texto del sidebar al
  colapsar/expandir — hoy sin uso en clases porque esa transición vive en
  un `style={{transition:...}}` inline; token dejado a propósito para
  cuando se necesite como clase), `delay-sidebar-width` (60ms, delay del
  ancho del `<aside>` al colapsar), `duration-highlight` (250ms, highlight
  de asignación de `EquipoSucursalPanel`) y `duration-tooltip` (120ms,
  tooltip de hover en `AgendaDayView.tsx`, sin relación con el sidebar
  pese a compartir valor). Si aparece un cuarto uso de cualquiera de estos
  4 valores, reusar el nombre en vez de escribir el número suelto de
  nuevo. Los 3 warnings de "clase ambigua" de Tailwind detectados en esta
  tanda quedaron resueltos (0/3).
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

## Fase 3 — Formularios (auditoría 2026-07-08)

> Inventario y diagnóstico puro, sin implementación. Fuera de alcance: Auth,
> Homepage, portal público de reservas (su stepper se audita en Fase 4), las
> animaciones de Cobrar (cerradas en Fase 2) y el sidebar de escritorio.

### F3.0 Hallazgo estructural — la premisa del stack es falsa

El contexto del proyecto describe "formularios con react-hook-form + zod".
**El código dice otra cosa**: hay **0 usos de `useForm`** en todo `src/`.
`react-hook-form` solo aparece dentro de `ui/form.tsx` (el wrapper shadcn
Form/FormField/FormMessage, completo y correcto, con `aria-invalid` y estados
de error — `form.tsx:81,92-94,121`), que **ningún componente importa: es
código muerto**. `zod` se usa en exactamente **un** archivo
(`InviteUserDialog.tsx:2`, schema + `.safeParse()` manual en `:86-95`, sin
`zodResolver` — `@hookform/resolvers` tampoco se importa nunca). El 100% de
los formularios reales es `useState` + validación imperativa. Esto no es un
hallazgo cosmético: **cualquier plan de normalización tiene que decidir
primero el stack** (adoptar el wrapper que ya existe, o borrarlo y formalizar
el patrón manual).

Además, ningún componente base (`Input`, `Textarea`, `Select`, `Checkbox`,
`RadioGroup`, `Switch`) tiene estado de error nativo (ni borde rojo ni
`aria-invalid`); cada formulario lo resuelve con `className` condicional
(ej. `ChangePasswordForm.tsx:114`, `EquipoUnificado.tsx:1632`,
`phone-input.tsx:244`). `aria-invalid` a mano existe solo en 2 archivos
(`TareaFormDialog.tsx:266,286` y `TareaRecurrenteFormDialog`). `Button` no
tiene prop `loading`; cada form compone su spinner a mano.

### F3.1 Inventario de formularios — 38 relevados

Conteo por cluster (alta/edición con campos; excluye confirmaciones puras
como `MoveConfirmDialog`/`TurnoConflictDialog`, y listas de toggles como
`PinActionsToggleList`):

| Cluster | Total | DrawerForm | Dialog centrado | Sheet crudo/manual | Popover | Inline en página |
|---|---|---|---|---|---|---|
| Configuración (catálogo, pagos, horarios, comisiones, PINs, productos) | 18 | 6 | 4 | 1 | 1 | 6 |
| Finanzas | 6 | 0 | 3 | 0 | 0 | 3 (Card siempre visible) |
| Turnos/Agenda | 4 | 0 | 4 | 0 | 0 | 0 |
| Tareas | 2 | 0 | 0 | 2 (markup de DrawerForm duplicado a mano) | 0 | 0 |
| Mi Negocio + Clientes | 7 | 2 (EquipoUnificado:1264, InviteUserDialog:194) | 3 (Nueva sucursal `MiNegocioPanel:522`, `NuevoClienteDialog:120`, `ClienteDetailDialog:268/294`) | 0 | 0 | 2 (StaffConfig, SucursalTabContent) |
| Cobrar | 1 | — | — | — | — | Stepper full-page propio |
| **Total** | **38** | **8** | **14** | **3** | **1** | **11+1** |

**El canon "entidad → DrawerForm" se cumple en 8 de ~25 casos aplicables.**
Desvíos más significativos (mismo tipo de operación que los 8 canónicos,
contenedor distinto):

1. **`ProductoDialog.tsx:239` vs `ProductosGlobalConfig.tsx:252`** — la misma
   entidad Producto tiene DOS formularios independientes: Dialog centrado con
   tabs en sucursal, DrawerForm en catálogo global. Campos, validación y
   marcado de opcionales también difieren entre ambos.
2. **`NuevoClienteDialog.tsx:120`** — alta de Cliente (entidad principal) en
   Dialog centrado.
3. **`NewAppointmentDialog.tsx:427`** — alta de turno, el formulario más
   complejo del cluster de agenda, en Dialog `max-w-md`.
4. **`SueldosPanel.tsx:992`** y **`DeudasPanel.tsx:286`** — pagos (sueldo,
   deuda) en Dialog.
5. **`ServicesConfig.tsx:542`** — quick-create de línea en Dialog, cuando la
   creación completa de líneas usa DrawerForm en el mismo archivo.
6. **`TareaFormDialog.tsx:236` / `TareaRecurrenteFormDialog.tsx:201`** —
   replican a mano el markup header/body/footer de DrawerForm sobre un Sheet
   crudo en vez de importar el componente.
7. **`HorariosTrabajoSection` DayEditSheet (:289)** — Sheet crudo, con la
   particularidad de que **cada onChange persiste a Supabase al instante**
   (sin botón Guardar) — único formulario "sin borrador" de la app.

Nota: `SucursalesConfig.tsx` quedó relevado solo en su manejo de teléfono
(consistente); su contenedor no se verificó en esta pasada.

### F3.2 Validación y manejo de errores

Tres patrones conviven:

- **Solo toast al submit** (mayoría): toda Agenda (`NewAppointmentDialog`,
  `AppointmentDetailDialog`, `DayOffDialog`, `UnavailableSlotDialog`),
  Gastos, Sueldos, Inversiones/Deudas (alta), todo el catálogo de
  Configuración (Services/Lines/Extras/Discounts vía `validate*` + `toast.error`).
  El campo culpable nunca se marca — el usuario lee el toast y tiene que
  deducir qué corregir.
- **Error inline bajo el campo** (minoría): `TareaFormDialog`/`TareaRecurrente`
  (el patrón más completo: error tras primer submit + contador de caracteres +
  `aria-invalid`), `RegistrarPagoDialog` de Deudas (`DeudasPanel:309-315`),
  `CustomRepeatSheet:160`, `PinConfigSection:269-271`,
  `PaymentMethodsConfig:378-383`, `InviteUserDialog:309-360` (zod) y
  `PhoneInput` (que trae su propio error inline).
- **Cobrar** (`PaymentRegistration`): toasts al submit (`:531-596`) + un único
  feedback inline vivo (el split: "Debe coincidir exacto", `:1417-1422`) +
  auto-sanación silenciosa de estado por useEffect (`:230-237,486-513`).

Convención de facto sana pero no escrita: **error de campo → inline; error de
servidor/red → toast**. Solo ~8 de 38 formularios la cumplen.

### F3.3 Campo obligatorio — 4 variantes

1. Asterisco con estilo (`<span className="text-destructive">*</span>`):
   `BackfillWizard:334`, `VoidClosureDialog:51`.
2. Asterisco plano en el label: `NewAppointmentDialog:397-401`, Gastos,
   Inversiones, Deudas, Sueldos.
3. Solo "(opcional)" en los NO obligatorios (los obligatorios sin marca):
   el patrón más extendido (~35 usos) — todo el catálogo de Configuración,
   Tareas, DayOff/UnavailableSlot.
4. Nada (la obligatoriedad se descubre al fallar el submit): Servicios
   (Nombre/Duración), Descuentos, PINs, y hasta bloques enteros de
   formularios que en otra sección del MISMO form sí marcan
   (`NewAppointmentDialog`: sub-form cliente con asteriscos, bloque
   barbero/servicio/fecha sin marca siendo igual de obligatorio).

No existe `<Label required>` ni componente unificado.

### F3.4 Estados de envío y doble submit

- `disabled={saving}` durante envío es el patrón dominante (~40 usos) y el
  texto "Guardando..." es frecuente, pero el spinner `Loader2` aparece solo a
  veces (`InviteUserDialog:212`, `NuevoClienteDialog:286`,
  `PaymentRegistration:1525`…) y otras solo cambia el texto
  (`NewAppointmentDialog:507`, `DayOffDialog:72`, Gastos) — sin componente
  `Button loading` común.
- **Formularios SIN guard contra doble submit** (async sin `disabled` ni
  estado de loading): `LineQuickEditPopover:210-212`, `ServicesConfig`
  (Guardar/Guardar cambios `:340,344` y quick-create de línea `:565`),
  `ExtrasConfig:215,219`, `DiscountsConfig:423,427`, `LinesConfig` (solo el
  editar, `:338` — el agregar sí tiene guard: inconsistente dentro del mismo
  archivo), alta de Inversiones (`InversionesPanel:161`) y de Deudas
  (`DeudasPanel:152`), `ComisionEquipoConfig:400-404`.
- 🔴 **Cobrar**: el atajo de teclado Enter (`PaymentRegistration:691-695`)
  llama `handleSubmit()` directamente **sin chequear `isSubmitting`** — el
  guard vive solo en el `disabled` del botón. Vector real de doble cobro por
  teclado si el segundo Enter entra antes del re-render.

### F3.5 maxLength — estado real

**78 ocurrencias en 33 archivos** (el pendiente del informe funcional está
mayormente saldado). Límites de facto: 80 nombres/títulos, 120 email y
dirección, 240 descripciones/motivos/observaciones, 1500 notas de turno,
6 PIN/porcentajes. Contador de caracteres visible solo en Tareas y parte del
catálogo (`{n}/240`).

**Huecos concretos (texto libre que persiste en DB, sin límite):**
- Descripción de gasto (`GastosPanel:247-252`)
- Concepto de pago de sueldo (`SueldosPanel:1025-1031`)
- Motivo de ausencia (`BloqueosSection:201` — textarea sin maxLength)
- Nueva inversión: Nombre, Descripción y Acreedor, los tres sin límite
  (`InversionesPanel:104-131`)
- `CurrencyInput` no acota cantidad de dígitos enteros en ningún uso
  (verificado en `currency-input.tsx`: solo limita decimales)

### F3.6 Autofocus, cierre y estado residual

- **Autofocus**: 13 usos en 12 archivos, concentrados en dialogs de PIN y en
  inputs de búsqueda dentro de Popovers (`NewAppointmentDialog:304`,
  `AppointmentDetailDialog:426`). En formularios de alta/edición comunes, el
  único primer-campo con `autoFocus` explícito es `MarcasManagerDialog:114`.
  (Radix enfoca el primer focusable por defecto al abrir, así que el efecto
  práctico depende del orden del markup — no verificado en runtime.)
- **Orden de tab**: no se detectó ningún `tabIndex` manual en formularios; el
  orden sigue el DOM, que coincide con el orden visual en lo relevado.
- **Cambios sin guardar**: **ningún formulario de los 38 confirma antes de
  cerrar con datos cargados** — 0 usos de `confirm(`, `beforeunload`,
  `hasUnsaved`. Pérdida silenciosa universal. Dos excepciones parciales que
  prueban que el problema es conocido: "Cancelar venta" de Cobrar (AlertDialog
  con detalle de lo que se borra, `PaymentRegistration:1603-1621`) y
  `RegenerarPasswordDialog:41-45` (bloquea cierre durante loading + advierte
  antes de cerrar sin copiar).
- **Reset inconsistente al cerrar/cancelar**: la mayoría resetea el estado al
  cerrar; `SueldosPanel` NO (cerrar y reabrir muestra los datos viejos,
  `:887-889` solo resetea tras éxito), `BloqueosSection:206` y
  `ComisionProductosConfig:160-162` cancelan sin limpiar el borrador.

### F3.7 Teléfono

Núcleo **consistente**: `src/lib/phone.ts` (formato canónico `+54…` sin el 9,
post-migración 2026-05) + componente compartido `PhoneInput`
(`ui/phone-input.tsx`) usados por Staff, EquipoUnificado, Sucursales (alta y
edición), NuevoCliente, ClienteDetail y NewAppointment. Ningún formulario
interno trata el teléfono como texto libre. `InviteUserDialog` no pide
teléfono.

Desvíos menores:
1. `useSupabaseData.ts:9` y `phone-input.tsx:3` importan `libphonenumber-js`
   directo, contra la regla escrita en `phone.ts:4-5`.
2. Comentarios desactualizados que aún dicen `+549…`:
   `reservar/lib/phone.ts:24-26`, `clientes/import/lib/normalize.ts:16`
   (comportamiento correcto, doc vieja).
3. `ClientesPanel:139` muestra el E.164 crudo en la lista, sin
   `formatPhoneDisplay` (los detalles sí formatean).
4. Mensaje de error hardcodeado "Ingresa un telefono valido" (¡en tuteo!) en
   `NuevoClienteDialog` y `NewAppointmentDialog:284-286`, en vez de
   `phoneErrorMessage()`.
5. `useClientes.ts:171-180` — si el update recibe un teléfono no
   canonicalizable, lo guarda como `null` en silencio en vez de rechazar
   (a confirmar si algún caller puede llegar ahí sin validar antes).
6. El portal público duplica la UI de selector-país+teléfono en vez de
   reutilizar `PhoneInput` — se audita en Fase 4.

### F3.8 Selects vacíos

Sin patrón. Tres niveles conviven:

- **Bien resuelto** (mensaje + contexto/CTA): Cobrar sin barberos
  (`PaymentRegistration:915-928`, mensaje por rol + botón "Añadir miembro"),
  Cobrar sin métodos de pago (`:1290-1296`),
  `ComisionEquipoConfig:422-424` ("No hay barberos disponibles para asignar.").
- **Fallback estructural** (nunca queda vacío): "Asignación" en Tareas (ítem
  fijo "Todo el equipo"), "Línea" en Servicios ("Sin línea"), "Marca" en
  Productos ("Sin marca"), "Aplica a" en Bloqueos ("Toda la sucursal").
- **Mudo** (dropdown en blanco, sin explicación): Barbero y Servicio en
  `NewAppointmentDialog:469-487`, Servicio/Profesional en
  `AppointmentDetailDialog:607-629`, Barbero en `UnavailableSlotDialog:68-75`,
  Empleado en `SueldosPanel:1003-1009`, barbero en
  `HorariosTrabajoSection:605-623`. En Cobrar: paso Servicios y paso Extras
  quedan mudos si las listas están vacías (`:1135-1149`), y el split con
  0 métodos electrónicos solo se explica vía `title` (tooltip nativo,
  `:1336-1338`).

### F3.9 Inconsistencias (priorizadas)

**P1 — Visible y molesto**

| # | Qué | Dónde |
|---|---|---|
| 1 | Doble submit posible: 8+ formularios async sin guard + el Enter de Cobrar que no chequea `isSubmitting` (riesgo de doble cobro, el flujo más crítico del producto) | F3.4 |
| 2 | Validación solo-toast sin marcar el campo culpable en la mayoría de la app (toda Agenda, Gastos, Sueldos, catálogo) | F3.2 |
| 3 | 5+ selects que bloquean el flujo quedan mudos cuando su lista está vacía (crear turno sin barberos/servicios es indescifrable para un usuario nuevo) | F3.8 |

**P2 — Repetido / sistémico**

| # | Qué |
|---|---|
| 4 | Contenedor sin canon efectivo: 14 Dialog vs 8 DrawerForm para operaciones equivalentes; Producto con 2 formularios distintos para la misma entidad; Tareas duplica el markup de DrawerForm a mano |
| 5 | 4 variantes de marcado de obligatorio, inconsistentes incluso dentro del mismo formulario |
| 6 | Pérdida silenciosa universal al cerrar con cambios (0 confirmaciones en 38 forms) + reset inconsistente (Sueldos retiene datos viejos al reabrir) |
| 7 | Loading de submit sin patrón: spinner vs solo-texto vs nada; `Button` sin prop `loading` |
| 8 | maxLength con huecos en campos que persisten (gasto, sueldo, ausencia, inversiones) y `CurrencyInput` sin tope de dígitos |
| 9 | `form.tsx` (RHF+zod) muerto mientras el 100% de los forms es useState manual — stack sin decidir |

**P3 — Higiene menor**

| # | Qué |
|---|---|
| 10 | `aria-invalid` solo en Tareas; inputs base sin estado de error nativo |
| 11 | Contador de caracteres solo en Tareas y parte del catálogo |
| 12 | Autofocus casi nunca en el primer campo de formularios de alta |
| 13 | Teléfono: 2 imports directos de libphonenumber-js contra la regla de `phone.ts`, comentarios `+549` viejos, E.164 crudo en lista de clientes, "Ingresa un telefono valido" hardcodeado en tuteo |
| 14 | `WeekdayPicker` no se reutiliza en Horarios (chips ad-hoc); sus únicos usos reales son EquipoSucursalPanel y BarberSucursalesGeneralSection |
| 15 | `PinConfigSection:178` es el único `<form onSubmit>` semántico de la app; el resto son divs con onClick |
| 16 | DayEditSheet persiste cada cambio al instante sin "Guardar" — único form sin borrador, sin indicación de que ya guardó |

**Totales Fase 3:** 38 formularios · 3 P1 / 6 P2 / 7 P3 · 78 maxLength en 33
archivos con 8+ huecos concretos · 0 confirmaciones de cierre en toda la app.

### F3.10 Preguntas abiertas (para la fase de plan)

1. **Stack de formularios**: ¿se adopta react-hook-form+zod (el wrapper
   `ui/form.tsx` ya está listo y sin uso) o se declara canónico el patrón
   useState+helpers y se borra el wrapper? Todo lo demás (errores inline,
   obligatorios, disabled) depende de esta decisión.
2. **Canon de contenedor**: ¿se ratifica "entidad → DrawerForm, confirmación →
   Dialog, edición in-place → inline"? Y si sí, ¿migran los 14 Dialogs o se
   acepta Dialog para altas rápidas (cliente, turno, pagos)? ¿Producto se
   unifica en un solo formulario?
3. **Marcado de obligatorio**: ¿cuál de las 4 variantes queda? (la más
   extendida hoy es "(opcional) en los no obligatorios, nada en los
   obligatorios").
4. **Errores**: ¿se formaliza "campo → inline, servidor → toast" y se agrega
   estado de error a los inputs base?
5. **Doble submit**: ¿guard universal (y fix inmediato del Enter de Cobrar)?
   Esto es casi un bugfix — puede no esperar al plan general.
6. **Selects vacíos**: ¿patrón estándar "No hay X disponibles" + CTA de
   creación, como ya hacen Cobrar y ComisionEquipo?
7. **Cambios sin guardar**: ¿se define política (ej. confirmar solo en
   formularios con N+ campos tocados) o se acepta la pérdida silenciosa?
8. **maxLength**: ¿obligatorio en todo texto libre que persiste, con la tabla
   de facto 80/120/240/1500 como estándar?

### F3.11 Los dos formularios de Producto — comparación campo por campo

Profundización del hallazgo de F3.1 (#1: "la misma entidad Producto tiene DOS
formularios independientes"). Solo relevamiento — sin propuesta de unificación.

**`ProductoDialog.tsx`** — Dialog con tabs, invocado desde `ProductosConfig.tsx`
(vista de una sucursal específica; requiere `sucursalId`). Escribe en
`productos` (datos globales) y hace upsert en `productos_sucursal` (fila por
producto+sucursal).

**`ProductosGlobalConfig.tsx`** — DrawerForm, catálogo global de la
organización (no requiere sucursal). Escribe **solo** en `productos`. Ambos
archivos declaran esta división explícitamente en su propio código
(`ProductoDialog.tsx:244`: *"Los datos generales se aplican a toda la
organización. Los precios y stock son por sucursal."*;
`ProductosGlobalConfig.tsx:26`: *"Edita SOLO datos globales... No toca
productos_sucursal, stock ni precios por sucursal."*) — la separación de
responsabilidad es intencional y documentada, no un descuido.

| Campo | ProductoDialog (sucursal) | ProductosGlobalConfig (global) | Tabla.columna |
|---|---|---|---|
| Nombre | ✅ tab "Datos", `maxLength=80` | ✅ único form, `maxLength=80` | `productos.nombre` |
| Marca | ✅ tab "Datos", Select + botón "Gestionar" | ✅ mismo patrón, Select + botón "Gestionar" | `productos.marca_id` |
| Descripción | ✅ tab "Datos", opcional, `maxLength=240`, contador | ✅ opcional, `maxLength=240`, contador | `productos.descripcion` |
| Activo (global) | ❌ no editable acá (se activa/desactiva desde `ProductosConfig` o queda `true` al crear) | ✅ vía footer "Activar"/"Desactivar" + `AlertDialog` de confirmación | `productos.activo` |
| **Activo en esta sucursal** | ✅ `Switch` en el header del Dialog | ❌ no existe (no hay concepto de sucursal) | `productos_sucursal.activo` |
| **Precio costo** | ✅ tab "Precio y stock" | ❌ | `productos_sucursal.precio_costo` |
| **Precio venta** | ✅ tab "Precio y stock", obligatorio (`canSave` lo exige) | ❌ | `productos_sucursal.precio_venta` |
| **Margen estimado** | ✅ campo de solo lectura, calculado (`(venta-costo)/costo`) | ❌ | `productos_sucursal.margen_pct` (derivado, no persistido como input) |
| **Stock mínimo** | ✅ tab "Precio y stock" | ❌ | `productos_sucursal.stock_minimo` |
| **Stock inicial** | ✅ solo si es alta o la sucursal aún no tiene vínculo (`isNew \|\| !producto?.sucursal`) — genera un `registrar_movimiento_stock` | ❌ | vía RPC, no es columna directa |
| **Comisión (modo + %)** | ✅ tab "Comisión" completa (barbero/ninguna/personalizada) | ❌ | `productos_sucursal.comision_modo`, `.comision_porcentaje` |

**Respuesta al punto 2 (qué representan los campos exclusivos):** todos los
campos exclusivos de `ProductoDialog` son datos que **varían por sucursal**
dentro del mismo negocio — el mismo producto puede costar distinto, tener
stock distinto y generar comisión distinta en cada local. Están modelados
correctamente como una tabla aparte (`productos_sucursal`, fila por
`producto_id`+`sucursal_id`), no como columnas de `productos`.

**Respuesta al punto 3 (¿aplican al catálogo global?):** no — son
estructuralmente inaplicables ahí. El catálogo global (`ProductosGlobalConfig`)
no tiene ni conoce un `sucursal_id`; no hay "el" precio o "el" stock de un
producto a nivel organización, solo a nivel sucursal. Confirmado por el propio
código: no existe ningún estado ni columna para precio/stock a nivel
`productos` (la tabla global) en todo el archivo. Es una diferencia de
**alcance del dato**, no una omisión.

**Punto 4 — diferencias de validación y marcado de obligatorio en los 3 campos
COMPARTIDOS** (Nombre/Marca/Descripción):

| Aspecto | ProductoDialog | ProductosGlobalConfig |
|---|---|---|
| Validación de Nombre | `tabErrors.datos` reactivo + bloquea el submit (`canSave`) + marca la pestaña con un punto rojo tras `submitAttempted` | `if (!nombre) toast.error(...)`, sin marca visual, solo al hacer click |
| Mensaje de error | `toast.error('Completá el nombre del producto.')` | `toast.error('Ingresá un nombre')` — copy distinto para el mismo caso |
| Precio venta | Obligatorio, valida `>= 0` y bloquea `canSave` (no existe en el otro form) | N/A (el campo no existe acá) |
| Etiqueta "(opcional)" | Solo en Descripción y Stock inicial (`<span className="text-muted-foreground font-normal">`) | Solo en el placeholder del Textarea ("Detalles internos (opcional)"), no en el `<label>` — inconsistente incluso dentro del propio patrón ya documentado en F3.3 |
| Nombre del label | `<Label>` (componente shadcn) | `<label className="text-sm font-medium">` (HTML crudo, no el componente `Label`) — mismo campo, dos formas de declarar el label |
| maxLength Nombre/Descripción | 80 / 240, con contador solo en Descripción | 80 / 240, con contador en Descripción — **coinciden** en los límites numéricos |
| Estado de envío | `saving` + texto "Guardando..." (sin spinner) | `saving` + texto "Guardando…" (con "…" tipográfico distinto: `…` vs `...`) |

*Método F3.11: lectura completa de `ProductoDialog.tsx`, `ProductosGlobalConfig.tsx`
y `productos/types.ts` (`Producto`, `ProductoSucursal`, `ProductoConSucursal`),
más confirmación del punto de invocación de `ProductoDialog` en
`ProductosConfig.tsx:218` (requiere `sucursalId`) al 2026-07-09.*

---

## Decisiones tomadas — Canon de contenedor (2026-07-09)

Cierra la pregunta abierta F3.10 #2 ("¿se ratifica DrawerForm como canon?").
Queda fijo para la Fase 4 (Módulos) — no se re-discute ahí, se aplica.

1. **DrawerForm es el único canon para alta/edición de entidades.** Migran
   los 14 `Dialog` centrados relevados en F3.1 (incluye `NuevoClienteDialog`,
   `NewAppointmentDialog`, `AppointmentDetailDialog`, `SueldosPanel`,
   `DeudasPanel` → `RegistrarPagoDialog`, `ProductoDialog`, ambos
   `MarcasManagerDialog`/`ServicesConfig` quick-create de línea, etc.) y los
   3 formularios armados a mano sobre `Sheet` crudo replicando el markup de
   DrawerForm en vez de importarlo (`TareaFormDialog`,
   `TareaRecurrenteFormDialog`, `HorariosTrabajoSection` → `DayEditSheet`).
   **Sin excepción por tipo de operación**: alta rápida y edición completa
   comparten el mismo contenedor — no hay un canon separado para "modales
   chicos".
2. **`HorariosTrabajoSection` pierde el autosave instantáneo.** Hoy cada
   cambio de horario escribe a Supabase al toque (`DayEditSheet`, sin
   borrador ni botón Guardar — el único formulario de todo el relevamiento
   sin ese patrón, F3.1). Pasa a comportarse como el resto: cambios en
   estado local + botón "Guardar" explícito + los mismos estados de
   envío/loading (disabled + texto/spinner) que el resto de los formularios
   migrados.
3. **Producto NO se fusiona.** `ProductoDialog.tsx` (datos por sucursal, en
   `productos_sucursal`) y `ProductosGlobalConfig.tsx` (datos globales, en
   `productos`) son formularios legítimamente distintos por alcance de dato
   (F3.11) — se mantienen **separados**, ambos migrados a DrawerForm. Lo que
   sí se unifica es la **implementación** de los 3 campos que comparten
   (Nombre, Marca, Descripción): misma validación, mismo copy de error,
   mismo componente `Label` — eliminando la duplicación de código real
   detectada en F3.11, sin tocar los campos exclusivos de cada uno.
4. **Micro-ediciones de 1-2 campos también migran, sin excepción.**
   `LineQuickEditPopover` (hoy `Popover`) y cualquier editor rápido
   equivalente pasan a DrawerForm — no queda un canon aparte para ediciones
   chicas.

---

*Método F3: relevamiento distribuido en 5 pasadas (componentes base;
Configuración; Mi Negocio+Clientes; Finanzas+Turnos+Tareas; Cobrar+teléfono)
con lectura de archivos y barridos ripgrep (`useForm`, `zod`, `toast.error`,
`maxLength=`, `autoFocus`, `confirm(`/`isDirty`/`hasUnsaved`,
`disabled={saving}`, `libphonenumber-js`) al 2026-07-08. La pasada de
Mi Negocio+Clientes se completó con verificación directa tras un corte de la
pasada automática. `SucursalesConfig.tsx` quedó relevado solo parcialmente
(teléfono). El focus-trap de Radix en runtime no se verificó (solo props
`autoFocus` explícitas en código).*

---

## Sesión dedicada — Sidebar de escritorio (build 2026-07-12)

Cierra los puntos de decisión que habían quedado pausados sobre
`AppSidebar.tsx` (logo, info de usuario, chevron durante el colapso — ver
Fase 2, F2.3.a), con la decisión validada por mockup: **"Opción B — el texto
se va primero, el espacio se cierra después"**.

> ⚠️ **Nota de historial (corregida)**: una primera versión de esta sección
> (fechada 2026-07-08) documentaba una implementación que nunca llegó al
> código. Una segunda versión (la que estuvo publicada hasta ahora, también
> fechada 2026-07-12) la reemplazó pero **tampoco describía el código real**
> en tres puntos: un chevron circular de 24px anclado al borde que no existe,
> y un footer + selector de sucursal descritos como "resueltos sin swap
> condicional" cuando el código real los mantiene como swap condicional
> (con un comentario del propio archivo diciéndolo explícitamente). Esta
> versión fue releída línea por línea contra `AppSidebar.tsx` tal como está
> hoy y corrige los tres puntos.

- **Chevron**: es **un solo botón** (ya no hay `ChevronRight` en el import,
  un único handler `setCollapsed(!collapsed)`), pero **no es circular ni
  está anclado al borde**: es el mismo botón navy `w-full` de siempre, al
  pie del sidebar, dentro del bloque de usuario/sesión (`:470-485`). Lo
  único nuevo es que el ícono `ChevronLeft` rota 180° in-place
  (`transition-transform duration-200 [transition-timing-function:var(--ease-out-quint)]`,
  clase `rotate-180` condicionada a `collapsed`) en vez de intercambiarse por
  `ChevronRight`.
- **3 de las 5 zonas quedaron persistentes en el DOM + opacity** (logo,
  labels de nav, section labels); **2 no** (footer, selector de sucursal):
  1. *Logo* (`:267-325`): tile navy 40px fijo; el padding del header
     (`paddingLeft/Right`) y el bloque de texto (nombre + punto/badge)
     transicionan vía estilos inline con la curva compartida `SIZE_EASE`.
  2. *Labels de nav* (`renderNavItem`, `:117-204`): un solo `<span>` de
     ícono persiste y transiciona `width/height/border-radius/
     background-color/color` entre sus 3 tamaños de reposo (40px en rail,
     28px activo expandido, 20px inactivo expandido); el label de texto
     persiste con `opacity`+`margin-left`+`flex-basis` inline. El badge de
     candado (plan bloqueado) **sigue siendo condicional, no crossfade**:
     `isPlanLocked && railMode` renderiza el punto circular sobre el ícono,
     `!railMode && isPlanLocked` renderiza la pastilla con texto — nunca
     coexisten en el DOM.
  3. *Section labels* (`:350-400`): "Principal" y "Gestión" sí persisten con
     altura estable (sin salto vertical); el divisor del riel coexiste con
     "Gestión" en un contenedor `relative`, cruzando opacity en fase
     inversa — esta parte del reporte anterior era correcta.
  4. *Footer de usuario* (`:410-469`): **sigue siendo swap condicional**
     (`railMode ? <columna> : <fila>`), tal como lo dice el comentario en el
     propio código (`:403-409`): "el bloque avatar+campana+candado NO se
     unificó... flex-direction no es una propiedad animable por CSS". No se
     tocó en esta sesión ni en ninguna posterior.
  5. *Selector de sucursal* (`:337-347`): **sigue siendo swap condicional**
     en dos ubicaciones del DOM distintas — `{!railMode && (...)}` dentro
     del header y `{railMode && <SucursalSelector collapsed />}` como
     hermano fuera del header — no un crossfade en una sola celda de grid.
     (La variante expandida sí cambió de aspecto en una sesión posterior:
     ver "Sesión dedicada — Header + selector de sucursal".)
- **Timing — Opción B**, implementado con una curva compartida
  `SIZE_EASE = 'var(--ease-out-quint)'` (`:47`) y un helper `textTransition()`
  (`:71-76`) que arma el string de `transition` inline según `railMode`:
  - Colapsar: texto `opacity 1→0` 120ms `var(--ease-in-quint)` sin delay;
    ancho del `<aside>` 200ms `var(--ease-out-quint)` con delay — token
    Tailwind custom `delay-sidebar-width` (`tailwind.config.ts:117`,
    `transitionDelay: { "sidebar-width": "60ms" }`).
  - Expandir: ancho sin delay; texto `opacity 0→1` 150ms
    `var(--ease-out-quint)` con delay 80ms.
  - El resto de propiedades de "tamaño" (padding, margin, max-height, el
    resize del ícono de nav) comparten `SIZE_EASE`/200ms para sentirse parte
    del mismo movimiento.
- **Técnica**: se mantiene la animación de `width` en el `<aside>` (decisión
  ya tomada, no se migró a compositor).

*Método de esta corrección: lectura completa y línea por línea de
`AppSidebar.tsx` tal como está en el repo hoy, sin asumir que el reporte
previamente publicado en este documento fuera exacto — fue precisamente al
compararlo contra el archivo que se encontraron las tres discrepancias de
arriba.*

---

## Sesión dedicada — Header + selector de sucursal (build, dirección "Variante J")

Rediseño acotado del header del sidebar expandido (`AppSidebar.tsx`,
`SucursalSelector.tsx`). No tocó la mecánica de colapso/expansión (sección
anterior) ni el rail — verificado igual en ambos casos.

- **Punto indicador reemplaza el badge de plan/facturación**: el nombre de
  la organización se mantiene igual; PREMIUM, el badge de plan genérico y el
  aviso de vencimiento con texto se reemplazaron por un punto de 5px junto
  al nombre — ámbar (`--status-warning`) con tooltip de días si hay aviso de
  facturación, dorado (`#C39A45`) con tooltip "Plan Premium" si no hay aviso
  pero el plan es premium, nada si ninguna aplica. `title` + `aria-label`
  espejados para no perder legibilidad por lector de pantalla.
- **Selector de sucursal sin caja**: se sacó el fondo/borde tinte
  (`bg-primary/5 border-primary/15`) del wrapper; ahora es texto plano sobre
  el header, separado del nombre por un hairline `#EEEFF2` de 1px. Los
  overrides de color por descendiente sobre `SucursalSelector` se
  mantuvieron (el componente sigue diseñado para verse "navy claro" sobre
  fondo blanco).
- **Chevron del selector rotativo**: vía `className` en `SucursalSelector.tsx`
  (`[&[data-state=open]>svg]:rotate-180` + transición 200ms
  `var(--ease-out-quint)`), sin tocar `ui/select.tsx` compartido.
- **Menú refinado**, todo scoped a esta instancia (nunca al `Select` base):
  sombra ya era la canónica "flotante" (`shadow-md`, sin cambios); entrada
  fade+slide ya la traía Radix por defecto, solo se ató el timing a 200ms
  `var(--ease-out-quint)`; label "SUCURSALES" agregado (10px/uppercase/
  muted, mismo estilo que los section labels del nav); check en la sucursal
  activa ya venía nativo de `SelectItem`; hover por `data-[highlighted]:bg-[#F4F5F7]`.
- Verificado antes de tocar nada: `SucursalSelector` solo se usa en
  `AppSidebar.tsx` (2 invocaciones) — sin riesgo de efecto lateral en otras
  pantallas.

`npx tsc --noEmit` limpio. Archivos: `AppSidebar.tsx`, `SucursalSelector.tsx`.

> **Nota (sesión Variante K, 2026-07-13)**: el indicador de plan/facturación
> se sacó del header (el punto de 5px descripto arriba) y no tiene lugar
> visible en la app por ahora — pendiente de decidir dónde mostrarlo, si
> hace falta.

---

*Método: lectura completa de `src/index.css`, `tailwind.config.ts` y los 16
componentes compartidos/base relevantes, más barridos con ripgrep sobre `src/` para
hex, clases de color directas, sombras, z-index, radios y valores arbitrarios. Los
conteos son de ocurrencias en código al 2026-07-07 (incluye cambios sin commitear:
`PageHeader.tsx` nuevo, `AppPanelHeader.tsx` borrado). Único punto no verificable
estáticamente: la fuente efectiva en runtime (#2), marcado como "confirmar en
navegador". No se detectaron componentes usados solo dinámicamente que impidieran
rastrear instancias.*

---

## Fase 4 — Tanda 1: Operación diaria (auditoría 2026-07-09)

Relevamiento de Cobrar, Resumen/Cierre de caja y Turnos/Agenda contra los
criterios cerrados en Fases 1-3 + Canon de contenedor. Solo diagnóstico y
alcance por archivo — sin implementación.

### F4.1 Resumen / Cierre de caja — estado

Esta área no estaba en el inventario de 38 formularios de Fase 3. Relevada
desde cero:

**La vista principal (`DailySummary.tsx`) es una vista de resumen, no un
formulario.** Sus flujos de confirmación quedan fuera del canon de
contenedor (no son alta/edición de entidades):

- **Diálogo "Cierre de caja: {barbero}"** (Dialog inline en
  `DailySummary.tsx:959`): confirmación con resumen de transacciones, sin
  campos editables. Guard `disabled={isSaving}` + spinner ✅.
- **`VoidTransactionDialog.tsx`**: confirmación de anulación de venta con
  un Select de motivo (obligatorio vía botón deshabilitado). Guard interno
  `if (submitting) return` ✅. Conforme como confirmación.
- **`VoidClosureDialog.tsx`**: ídem para anular cierre. Guard
  `disabled={isLoading}` ✅. Desvío menor: marca el motivo con asterisco
  (`Motivo de la anulación *`) — el canon dice nada en obligatorios.
- **AlertDialog "Regularizar cierre"** (inline): confirmación pura, sin
  campos. Conforme.

**Los visores ya usan DrawerForm**: `CashClosingHistory`,
`AnulacionesCierreHistory`, `TransactionDetailDrawer` y
`MultiDayClosingSummary` (consulta por rango de fechas — no es alta/edición,
su "formulario" es un filtro de consulta). Nada que migrar.

**Excepción encontrada — `BackfillWizard.tsx` SÍ es un formulario de alta**
(crea un cierre diferido en `ingresos` vía `saveBackfill`), y es un **cuarto
Sheet armado a mano** que no está en los 3 contados por el Canon de
contenedor (Tareas x2 + HorariosTrabajoSection), porque esta área no se
relevó en Fase 3:

- Contenedor: `Sheet` crudo con header/stepper/footer artesanales, wizard de
  5 pasos (Barbero → Motivo → Servicios → Resumen → Confirmar).
- Campos: barbero (cards seleccionables), motivo (radio-cards, obligatorio,
  **marcado con asterisco** — desvío), nota (`Textarea`
  **`maxLength={500}` — fuera de la escala 80/120/240/1500**, marcada
  "(opcional)" ✅), montos por método (`CurrencyInput`), cantidad de
  servicios (`Input number`), grilla detallada con steppers +/-.
- Validación: imperativa por paso (`canAdvance()`), sin RHF+Zod.
- Guard doble submit: `disabled={isSaving}` en Confirmar ✅ (sin atajo Enter).

Ver decisión pendiente en F4.4 #1 — no se resuelve en esta auditoría.

`DailySummary` ya tiene `animate-fade-in` en la raíz ✅.

### F4.2 Cobrar (`PaymentRegistration.tsx`) — plan de migración (solo validación)

**Verificado, no es hallazgo**: el guard de doble submit del Enter corregido
en Fase 3 sigue intacto (`if (isSubmitting) return` antes de
`handleSubmit()` en el keydown handler, con `isSubmitting` en las deps del
`useEffect`). El botón "Registrar Cobro" y "Cobrar con Terminal" también
deshabilitan con `isSubmitting` ✅.

**Campos/estado actual** (todo `useState` + validación imperativa):

| Campo | Estado hoy | Regla |
|---|---|---|
| Barbero | `selectedBarber` (cards) | obligatorio si hay servicio |
| Servicio | `selectedService` (cards) | obligatorio salvo venta solo-productos |
| Extras | `selectedExtras[]` (cards toggle) | opcional |
| Descuento | `selectedDiscount` (cards, default 'none') | opcional; se anula solo si no aplica al método |
| Método de pago | `paymentMethod` (cards) | obligatorio |
| Split: montos | `efectivoAmount`/`mpAmount` (CurrencyInput) | ambos > 0, suma == total (±0.01), cada uno ≤ total |
| Split: método electrónico | `selectedDigitalMethod` (chips) | obligatorio en split |
| Carrito productos | `cart[]` + `productSaleAssignment` | venta no vacía (servicio o productos); sin ítems con precio faltante |

**Validaciones imperativas hoy** — 6 reglas en `handleSubmit` + 3
preventivas en los handlers de selección (servicio sin barbero, precio
pendiente en servicio/extra), **todas reportadas con toast destructivo**.
Desvío del canon: los errores de campo deben ser inline; el toast queda solo
para servidor/red (los dos toasts de error de red/imprevisto ya cumplen).

**Schema Zod correspondiente** (para el build): objeto único con
`barberId`, `serviceId`, `extraIds[]`, `discountId`, `paymentMethod`
(enum de `PAYMENT_METHODS` activos), `split { enabled, efectivo, digital,
digitalMethod }`, `cart[]`, con `superRefine` para las 5 reglas cruzadas
(venta no vacía; barbero requerido con servicio; método requerido; suma del
split == total; método electrónico requerido en split). La regla de "ítems
sin precio" depende de datos externos (config de precios) — entra como
refinement con contexto o se mantiene como guard previo. RHF registra como
campos reales solo los 2 `CurrencyInput` del split (los únicos inputs de
texto); las selecciones por cards escriben al form vía `setValue`. El estado
"Suma / Debe coincidir exacto" del split ya es feedback inline — se conserva
y se conecta al error del schema.

**maxLength**: N/A — Cobrar no tiene ningún campo de texto libre
persistente (solo montos y selecciones). ✅

**Obligatorios**: los labels del split ("Efectivo"/"Electrónico") no llevan
marca y son obligatorios — ya conforme.

Contenedor (stepper full-page propio) y animaciones: **sin cambios**, según
lo decidido.

### F4.3 Turnos/Agenda — plan por formulario

Estado actual de los 4 (todos **Dialog centrado → migran a DrawerForm**,
todos **useState + validación imperativa por toast → migran a RHF+Zod**):

| | NewAppointment | DayOff | UnavailableSlot | AppointmentDetail |
|---|---|---|---|---|
| Contenedor | Dialog | Dialog | Dialog | Dialog |
| Validación | imperativa, toasts | imperativa, 1 regla | imperativa, 2 reglas | imperativa + 409 del servidor |
| maxLength | ✅ completo (80/80/120 + notas 1500, query 80) | ✅ motivo 240 | ✅ motivo 240 | ✅ completo (80/80/120, motivo 240) |
| Guard doble submit | `disabled={saving}` | `disabled={saving}` | `disabled={saving}` | `disabled={saving}` en EditableSectionHeader y footer ✅ |
| Obligatorios | ❌ asteriscos en Nombre/Apellido/Teléfono; "(opcional)" ✅ en Email/Notas | ✅ ya conforme | ✅ ya conforme | ❌ asteriscos en form de cliente nuevo |
| Teléfono | ✅ PhoneInput canónico (e164) | — | — | ✅ PhoneInput canónico |
| Reset/defaults | ✅ resync al abrir + reset al cerrar | ❌ defaults congelados + motivo persiste | ❌ ídem | ✅ reset al cerrar |

- La cobertura de `maxLength` en Agenda es **completa y en escala** —
  ningún faltante. Los `.slice()` defensivos en submit se conservan.
- Ningún guard interno `if (saving) return` dentro de los `handleSubmit`,
  pero todos los caminos de invocación están cubiertos por `disabled`; la
  migración a RHF lo resuelve de fábrica (`formState.isSubmitting`).
- **Selects vacíos sin mensaje+CTA** (desvío del canon): barbero y servicio
  en NewAppointment/UnavailableSlot/AppointmentDetail renderizan un Select
  sin ítems si no hay barberos activos o servicios — falta el patrón
  mensaje + CTA ya usado en Cobrar.
- **Bug de estado en DayOff y UnavailableSlot**: los 4 diálogos viven
  montados permanentemente en `AgendaPanel.tsx:291-331` (controlados por
  `open`), pero estos dos inicializan fecha/hora con `useState(initializer)`
  — corre una sola vez al montar. Si el usuario navega la agenda a otra
  fecha y abre "Día off", el formulario muestra la fecha del primer render,
  no la seleccionada. Además `motivo` no se resetea al cerrar (reabre con el
  texto anterior). `NewAppointmentDialog` lo hace bien (resync en `useEffect`
  sobre `open` + `reset()` al cerrar) — es la referencia para el build.
- **Schemas Zod**: DayOff (rango de fechas con refine fin ≥ inicio + motivo
  opcional) y UnavailableSlot (barbero requerido + refine hora fin > inicio)
  son triviales. NewAppointment necesita **unión discriminada por `mode`**
  (`existing` → cliente seleccionado requerido; `new` → nombre/apellido/
  teléfono válidos + email opcional con regex; `quick` → sin cliente) +
  campos comunes (barbero, servicio, fecha, hora).

**AppointmentDetailDialog — qué preservar al migrar (Stage 1 verificado
intacto al 2026-07-09):**

1. **Header**: `InitialsAvatar` + nombre + `StatusPill` (vía
   `TURNO_ESTADO_PILL`). DrawerForm debe aceptar/replicar esta composición
   de título.
2. **Edición por secciones con `EditableSectionHeader`** y exclusión mutua
   (editar cliente ↔ editar turno ↔ cancelar se bloquean entre sí vía
   `disabled`). NO aplanar a un formulario único: la migración a RHF es
   **por sección** (un `useForm` por editor, montado al entrar en modo
   edición), manteniendo la semántica de guardar cada sección por separado.
3. **Flujo de cancelación inline** (motivo opcional + confirmación en el
   footer) — es una confirmación, no cambia de contenedor.
4. **`TurnoConflictDialog` + semántica 409 del servidor**
   (`choque_de_horario`/`fuera_de_horario` con re-submit confirmado, más los
   6 códigos de error de negocio con toast). Es un canal de error de
   servidor ya decidido — la migración a RHF no lo toca; solo los errores
   de campo locales (fecha vacía, hora inválida, cliente incompleto) pasan
   a inline.
5. **`readOnly`** y los permisos por estado del turno (`canCancel`/
   `canEditCliente`/`canEditTurno`).
6. **Búsqueda de cliente** con debounce + token anti-race y el `PhoneInput`
   canónico (compartidos textualmente con NewAppointmentDialog — candidato a
   extraer a componente común en el build, análogo a la unificación de
   campos compartidos de Producto).

**Fade de entrada (Fase 2)**: la página Turnos ya lo tiene
(`TurnosAgendaPanel.tsx:112` con `animate-fade-in` en la raíz) — no falta
aplicarlo. Hallazgo menor aparte en F4.4 #5.

### F4.4 Hallazgos nuevos (no encajan en criterios ya cerrados)

1. **Contenedor de `BackfillWizard` — decisión pendiente.** Es un formulario
   real de alta con wizard de 5 pasos. El canon dice "DrawerForm sin
   excepciones", pero la única analogía existente es Cobrar (stepper con
   excepción explícita de contenedor). Opciones: (a) migrar a DrawerForm con
   el stepper adentro del body, o (b) extender la excepción de Cobrar a los
   wizards multi-paso. No se resuelve acá — requiere decisión.
2. **`BackfillWizard` nota con `maxLength={500}`**: fuera de la escala
   80/120/240/1500. Corresponde decidir si baja a 240 o sube a 1500 (por
   contenido es una nota breve → 240 parece el tier natural, pero acorta un
   límite existente: puede truncar hábitos de usuarios actuales).
3. **Defaults congelados + motivo persistente en DayOff/UnavailableSlot**
   (detalle en F4.3). Bug funcional de UX, no solo de canon — entra al
   build de Agenda de esta tanda.
4. **Asteriscos residuales** en VoidClosureDialog (confirmación, fuera de
   canon de contenedor pero el criterio de marcado es transversal) y
   BackfillWizard. Cambio trivial de copy.
5. **Cambio de vista Día/3días/Semana en `AgendaPanel.tsx:247-289`** usa
   `animate-in fade-in slide-in-from-bottom-1 duration-150 ease-out`
   (tailwindcss-animate con easing nativo) en vez del timing canónico
   200ms `--ease-out-quint`. P3 — retimar en el build de Agenda o dejar
   explícitamente como está.

---

*Método F4-T1: lectura completa de `DailySummary.tsx`,
`VoidTransactionDialog.tsx`, `VoidClosureDialog.tsx`,
`MultiDayClosingSummary.tsx`, `BackfillWizard.tsx`,
`PaymentRegistration.tsx` (1658 líneas), los 4 diálogos de agenda,
`EditableSectionHeader.tsx` y `AgendaPanel.tsx` (zona de montaje de
diálogos), más barridos ripgrep (`animate-fade-in`, `maxLength`,
`DrawerForm|SheetContent|DialogContent`) sobre Caja y Agenda al 2026-07-09.
`CashClosingHistory`/`AnulacionesCierreHistory`/`TransactionDetailDrawer` se
verificaron por grep de contenedor y campos (visores DrawerForm sin
formularios). No se modificó código.*

---

## Fase 4 - Tanda 1 - Build Parte 1 (Agenda) — 2026-07-09

Ejecuta el plan de F4.3 sobre los 4 formularios de Agenda. Cobrar,
Caja/Resumen y `BackfillWizard` quedan intactos para la Parte 2.

### Archivos modificados

- `src/components/agenda/DayOffDialog.tsx` — reescrito.
- `src/components/agenda/UnavailableSlotDialog.tsx` — reescrito.
- `src/components/agenda/NewAppointmentDialog.tsx` — reescrito.
- `src/components/agenda/AppointmentDetailDialog.tsx` — reescrito.
- `src/components/agenda/AgendaPanel.tsx` — solo el retimado del cambio de
  vista (líneas ~247-289).
- `src/components/ui/drawer-form.tsx` — `title` amplía de `string` a
  `React.ReactNode` (extensión aditiva, sin romper los ~19 consumidores
  existentes; todos pasan strings literales, que siguen siendo válidos).

**Archivos nuevos** (extracción del punto 7 + utilidades compartidas):

- `src/components/agenda/hooks/useClienteSearch.ts` — hook con la búsqueda
  de cliente (debounce 250ms + token anti-race) y `ensureRelacion`,
  extraído de la lógica duplicada en NewAppointmentDialog y
  AppointmentDetailDialog.
- `src/components/agenda/ClienteSearchPicker.tsx` — Popover de búsqueda de
  cliente existente, compartido por ambos diálogos.
- `src/components/agenda/ClienteFormFields.tsx` — sub-formulario de
  "cliente nuevo" (Nombre/Apellido/Teléfono/Email) sobre RHF, compartido
  por ambos diálogos; sin asteriscos, "(opcional)" solo en Email.
- `src/components/agenda/clienteModeSchema.ts` — schema Zod + validación
  cruzada por modo (`existing`/`new`) compartida por NewAppointmentDialog y
  AppointmentDetailDialog.
- `src/components/agenda/EmptySelectHint.tsx` — mensaje + CTA para Selects
  sin ítems (mismo patrón que Cobrar).

### Resumen por archivo

**DayOffDialog / UnavailableSlotDialog**: contenedor Dialog → DrawerForm
(`size="sm"`); validación imperativa → RHF + `zodResolver` (schemas
triviales: rango de fechas con `refine` fin ≥ inicio; barbero requerido +
`refine` hora fin > inicio). Bug de fecha congelada corregido: un único
`useEffect` sobre `open` llama `form.reset(...)` con los defaults actuales
de la agenda en cada apertura — reemplaza el `useState(initializer)` que
solo corría una vez. El motivo ahora se resetea junto con todo lo demás en
cada apertura (antes persistía). UnavailableSlotDialog suma
`EmptySelectHint` cuando no hay barberos activos (deshabilita también el
submit). Guard de doble submit: `form.formState.isSubmitting` (RHF), sin
guard manual.

**NewAppointmentDialog**: contenedor Dialog → DrawerForm (`size="md"`).
Validación: en vez de un `z.discriminatedUnion` literal (que generaba
fricción de tipos con `useForm` por tener shapes distintas por rama), se
implementó como **un schema plano con `superRefine` que discrimina por el
campo `mode`** (`existing`/`new`/`quick`) — mismo comportamiento de
validación que una unión discriminada, mejor ergonomía con RHF. La
validación cruzada de modo cliente se comparte con AppointmentDetailDialog
vía `clienteModeSchema.ts`. Se agregó `EmptySelectHint` en barbero y
servicio. Se quitaron los asteriscos de Nombre/Apellido/Teléfono (ya sin
marca, consistente con barbero/servicio/fecha/hora que tampoco llevaban
marca); Email/Notas mantienen "(opcional)". El bug-fix-pattern (reset
completo en `useEffect` sobre `open`) que este diálogo ya aplicaba
correctamente se preservó tal cual, ahora expresado como un único
`form.reset(defaultValues())` que reemplaza el `reset()` parcial + el
`useEffect` de sync que antes vivían separados.

**AppointmentDetailDialog**: contenedor Dialog → DrawerForm (`size="md"`)
con **título compuesto** (`InitialsAvatar` + nombre + `StatusPill`) pasado
como `ReactNode` a la prop `title` extendida. Migración **por sección**,
tal como exigía el candado de alcance: un `useForm` independiente para el
editor de cliente (`clienteEditSchema`, reutiliza `clienteModeSchema.ts`) y
otro para el editor de turno (`turnoEditSchema`: servicio/barbero
requeridos, fecha vía `z.custom<Date | null>`, hora vía regex HH:MM). La
exclusión mutua existente (`disabled` cruzado entre ambos
`EditableSectionHeader` y `confirmingCancel`) **no se tocó** — sigue
funcionando igual porque ambos forms son independientes y los `disabled`
siguen leyendo los mismos tres booleanos de estado (`editingCliente`,
`editingTurno`, `confirmingCancel`). El flujo de cancelación (motivo +
confirmación) se dejó **exactamente como estaba**, sin RHF, según lo
pedido. Los errores locales de turno (fecha vacía, hora inválida) ahora son
inline vía `FormMessage`; el canal 409 (`TurnoConflictDialog`,
`choque_de_horario`/`fuera_de_horario`, los 6 códigos de error de negocio
con toast) **no se modificó**: `runUpdateTurno` recibe los valores ya
validados por RHF pero conserva la misma lógica de respuesta del servidor,
y el reintento tras conflicto (`handleConfirmConflict`) lee los valores
vigentes vía `turnoForm.getValues()` en vez de estado plano, sin cambiar el
comportamiento. Se agregó `EmptySelectHint` en servicio y profesional del
editor de turno. Asteriscos quitados del sub-formulario de cliente nuevo
(mismo criterio que NewAppointmentDialog).

**AgendaPanel.tsx**: el cambio de vista Día/3días/Semana pasa de
`duration-150 ease-out` a `duration-200
[animation-timing-function:var(--ease-out-quint)]` — mismo efecto visual
(fade + slide sutil desde abajo), timing canónico.

### TurnoConflictDialog — confirmación explícita

No se tocó. Sigue siendo un `Dialog` propio, sin cambios en su archivo, su
API (`open`/`kind`/`conflicts`/`onConfirm`/`loading`) ni su lógica de
render. `AppointmentDetailDialog` lo sigue montando fuera del `DrawerForm`
(como hermano, dentro de un fragment `<>...</>` ya que ahora hay dos
elementos de nivel superior).

### Punto 7 — extracción de búsqueda de cliente

**Se hizo.** La duplicación textual (debounce + token anti-race +
`ensureRelacion` + el Popover de búsqueda + el sub-form de cliente nuevo)
era mayor a la estimada en la auditoría — no solo la búsqueda, también el
formulario de cliente nuevo completo. Se extrajeron 4 piezas reutilizables
(`useClienteSearch`, `ClienteSearchPicker`, `ClienteFormFields`,
`clienteModeSchema`) en vez de una sola, porque cada una tiene un punto de
variación distinto entre los dos diálogos (contexto de habilitación,
nombres de campo del form padre) y forzar una única abstracción hubiera
sido más rígida que útil. El costo fue contenido: 4 archivos nuevos, ambos
diálogos consumidores quedaron más cortos que sus versiones pre-migración
pese a ganar RHF+Zod.

---

*Método: build directo sobre los 4 archivos listados en el candado de
alcance, verificando estado actual de cada uno con `Read` antes de asumir
los números de línea de la auditoría F4.3 (coincidían). Validación:
`npx tsc --noEmit` limpio tras el build completo. Lint (`eslint`) marca 5
usos de `any` preexistentes (cast de payload RPC/insert y `catch (e: any)`)
idénticos línea por línea a los del código original antes de esta
migración — no se tocaron por ser deuda preexistente ajena al alcance de
este build (fuera del criterio de validación pedido, que era `tsc`).*

---

## Regresión post-build Parte 1 — NewAppointmentDialog (2026-07-09)

QA reportó que al crear un turno que choca de horario, en vez de
`TurnoConflictDialog` aparecía el error crudo de Postgres ("conflicting
key value violates exclusion constraint 'no_overlap_turnos'"). Diagnóstico
(comparación contra `HEAD`, antes de tocar el archivo): **no fue una
regresión de la migración** — el `catch` de `NewAppointmentDialog` siempre
fue genérico, byte por byte igual antes/después. La detección específica
de este error **nunca existió** para el flujo de creación; solo existe
para editar/mover turnos (`update-turno-internal`, que hace un
pre-chequeo de conflictos antes de tocar la base). El botón "Guardar igual
(superponer)" de `TurnoConflictDialog` tampoco es viable para creación: ese
bypass depende de que el servidor setee `overlap_autorizado`, algo que solo
`update-turno-internal` puede hacer — un insert directo del cliente no
tiene forma de pasarlo.

**Fix aplicado (alcance mínimo, elegido por el usuario frente a la
alternativa de construir una edge function de creación con paridad
completa)**: en `NewAppointmentDialog.tsx`, el catch del insert ahora
detecta el código `23P01` (o el texto `no_overlap_turnos` como respaldo) y
muestra `"Ese horario ya está ocupado. Elegí otro horario o
profesional."` en vez del mensaje crudo. Sin botón de "guardar igual" — no
existe forma de cumplirlo para este flujo.

`AppointmentDetailDialog` (editar) se verificó sin regresión: cadena de
manejo de errores idéntica a `HEAD`.

---

## Fase 4 - Tanda 1 - Build Parte 2 (Cobrar + Caja) — 2026-07-09

Cierra la Tanda 1 completa. Cobrar migra solo su capa de validación
(contenedor y animaciones intactos, según lo decidido). `BackfillWizard`
mantiene su Sheet propio con wizard de 5 pasos — segunda excepción
explícita al canon de contenedor, junto con Cobrar.

### Archivos modificados

- `src/components/PaymentRegistration.tsx` — validación migrada a
  React Hook Form + Zod. Contenedor (stepper full-page) y animaciones
  (`step-in-*`, overlay/confirm, `payment-card-in`) sin cambios.
- `src/components/VoidClosureDialog.tsx` — se sacó el asterisco de
  "Motivo de la anulación".
- `src/components/BackfillWizard.tsx` — validación por paso migrada a
  React Hook Form + Zod. Contenedor (Sheet + wizard de 5 pasos) sin
  cambios. Nota: `maxLength` 500 → 240. Motivo: se sacó el asterisco.

### Cobrar — resumen de la migración

**Schema único** (`barberId`, `serviceId`, `extraIds[]`, `discountId`,
`paymentMethod`, `cart[]`, `split { enabled, efectivo, digital,
digitalMethod }`) con `superRefine` para las 5 reglas cruzadas (venta no
vacía → error en `root`; barbero requerido si hay servicio → `barberId`;
método de pago requerido → `paymentMethod`; suma del split == total → error
en `split.efectivo`, ya cubierto en vivo por el indicador "Suma / Debe
coincidir exacto" existente; método electrónico requerido en split →
`split.digitalMethod`). El total (necesario dentro del `superRefine` para
validar el split) se resuelve vía una ref actualizada en cada render — el
schema se construye una sola vez por instancia del componente y siempre lee
el total vigente al validar, sin necesidad de reconstruir el schema ni el
resolver en cada render.

**"Ítems sin precio pendiente"** se implementó como guard previo dentro del
propio submit ya validado (no en el schema, tal como se pidió — depende de
config externa de precios, no es forma del formulario), preservando el
mismo orden que tenía el handler imperativo original (venta vacía primero,
ítems sin precio segundo). Usa `form.setError('root', ...)`, compartiendo
el mismo slot visual que la regla de venta vacía.

**RHF registra como campos reales solo los 2 `CurrencyInput` del split**
(`split.efectivo`/`split.digital`, ahora vía `form.watch`/`form.setValue`
en vez de `useState` — la lógica de autocompletado cruzado entre ambos se
preservó intacta). Barbero, servicio, extras, descuento, método de pago y
carrito siguen su mecanismo de cards/estado local de siempre; cada handler
de selección ahora también hace `form.setValue(...)` + `form.trigger()`
para mantener el schema sincronizado y limpiar errores en vivo apenas el
usuario corrige el campo.

**Errores — alineados al canon**: los 6 tests de `handleSubmit` + la
validación de método electrónico en split, que eran 100% toast, ahora son
inline en la sección correspondiente (barbero, método de pago, split) o en
el bloque de resumen del paso de pago (venta vacía / ítems sin precio,
compartiendo el slot `root`). Los mensajes solo se muestran después de un
intento de submit (`form.formState.submitCount > 0`) para no mostrar ruido
antes de que el usuario intente cobrar. Los 2 toasts de error de
red/imprevisto ("No se pudo guardar el cobro" / "Error inesperado") se
dejaron exactamente como estaban.

**Guard de doble submit del Enter**: verificado intacto
(`if (isSubmitting) return;` antes de `handleSubmit()`, con el mismo
`isSubmitting` manual de siempre — no se reemplazó por
`formState.isSubmitting` de RHF porque ese mismo estado también gobierna el
flujo separado de "Cobrar con Terminal", que no pasa por
`form.handleSubmit`; ambos coexisten, tal como se pidió).

**`maxLength`**: confirmado N/A — Cobrar no tiene texto libre persistente.

### BackfillWizard — resumen de la migración

Un solo schema (`barberId`, `reason`, `note`, `hasServiceData`) para los 3
pasos con campos propios (Barbero/Motivo/Servicios); Resumen y Confirmar no
tienen validación de forma. `hasServiceData` espeja
`totals.totalCobrado > 0 || totals.services > 0` (que depende de
`items`/`quickAmounts`, fuera del form) vía un `useEffect`.

El gate "no avanzar si el paso es inválido" (antes `canAdvance()` ad hoc)
ahora lee `backfillSchema.shape.<campo>.safeParse(...)` directo en vez de
reimplementar las reglas a mano — mismo comportamiento visual (botón
"Siguiente" deshabilitado), pero la regla vive en el schema. Se mantuvo
como chequeo síncrono directo sobre el schema (no vía `formState.isValid`
de RHF) porque el botón necesita reaccionar en el mismo render en que
cambia la selección, sin esperar el ciclo async de validación de RHF.

`handleConfirm` suma `await form.trigger()` como red de seguridad antes de
guardar (los gates por paso ya deberían garantizar formulario válido al
llegar a "Confirmar"). El guard de doble submit del botón Confirmar
(`disabled={isSaving}`) no se tocó, tal como se pidió — es un wizard con
submit final, no un formulario RHF de un solo submit.

Ajustes puntuales aplicados: nota `maxLength` 500 → 240; asterisco sacado
de "Motivo del cierre diferido".

### Visores y diálogos ya conformes — sin cambios

`VoidTransactionDialog`, el diálogo "Cierre de caja: {barbero}", el
`AlertDialog` "Regularizar cierre", `CashClosingHistory`,
`AnulacionesCierreHistory`, `TransactionDetailDrawer` y
`MultiDayClosingSummary` — confirmados conformes en F4.1, no se tocaron.

---

*Método: lectura completa de `PaymentRegistration.tsx` (1658 líneas) y
`BackfillWizard.tsx` antes de editar, verificando que los números de línea
de la auditoría F4.2 coincidieran con el estado actual. Validación:
`npx tsc --noEmit` limpio tras el build completo (Cobrar + VoidClosureDialog
+ BackfillWizard). No se tocó ningún archivo fuera del candado de alcance
(Agenda, Sidebar, Portal, Auth, Homepage quedaron intactos).*

---

## Fase 4 - Tanda 2 - Parte 1: Configuración (auditoría 2026-07-13)

> Relevamiento puro contra los criterios ya cerrados (sombras/z-index/Inter/
> timing, RHF+Zod, errores campo→inline/servidor→toast, "(opcional)" en no
> obligatorios, selects vacíos con mensaje+CTA, maxLength 80/120/240/1500,
> DrawerForm único canon salvo Cobrar y BackfillWizard, HorariosTrabajoSection
> pierde el autosave, Producto no se fusiona). Sin implementación. Método:
> lectura completa de los 14 archivos listados abajo (no de resúmenes de
> Fase 3) al 2026-07-13.

### 1. Tabla por formulario

| Formulario | Contenedor actual → destino | Validación actual | maxLength | Obligatorio | Guard doble submit | Selects vacíos |
|---|---|---|---|---|---|---|
| Servicios (`ServicesConfig.tsx`) | DrawerForm ✅ → sin cambio | toast-only | Nombre 80 ✅, Descripción 240 ✅ (con contador) | Nombre/Precio/Duración sin marca (variante 4); Descripción "(opcional)" ✅ | ❌ Guardar/Guardar cambios (`:340,344`) sin `disabled` | Línea: fallback "Sin línea" ✅ resuelto |
| ↳ quick-create "Nueva línea" (`ServicesConfig.tsx:542`, Dialog) | Dialog centrado → DrawerForm | toast-only | Nombre 80 ✅ | sin marca | ❌ `handleAddNewLine` es async, botón "Agregar" (`:565`) solo bloquea por `!newLineName.trim()`, no por loading | N/A |
| Líneas (`LinesConfig.tsx`) | DrawerForm ✅ → sin cambio | toast-only | Nombre 80 ✅, Descripción 240 ✅ | Nombre sin marca; Color/Descripción "(opcional)" ✅ | ⚠️ Agregar SÍ tiene guard (`isSaving`); Editar (`:338`) NO — inconsistente en el mismo archivo | N/A |
| Extras (`ExtrasConfig.tsx`) | DrawerForm ✅ → sin cambio | toast-only | Nombre 80 ✅ (sin campo Descripción) | Nombre/Precio sin marca | ❌ Guardar/Guardar cambios (`:215,219`) sin `disabled` | N/A |
| Descuentos (`DiscountsConfig.tsx`) | DrawerForm ✅ → sin cambio | toast-only | Nombre 80 ✅ (sin campo Descripción) | Nombre/Valor sin marca | ❌ Guardar (`:423`) sin `disabled` | Selects con opciones fijas (Aplica a/Tipo/Redondeo/Método) — nunca vacíos, no aplica |
| Producto — sucursal (`ProductoDialog.tsx`) | Dialog centrado → DrawerForm (decisión ya tomada) | mixto: `tabErrors` reactivo + `canSave` bloquea submit + toast | Nombre 80, Descripción 240 (coincide con el global) | Precio venta obligatorio vía `canSave`; "(opcional)" solo en Descripción/Stock inicial | ✅ `disabled={saving}` | No aplica (sin selects de lista dinámica relevados) |
| Producto — global (`ProductosGlobalConfig.tsx`) | **Ya es DrawerForm** ✅ | toast-only | Nombre 80, Descripción 240 | "(opcional)" solo en placeholder, no en el `<label>` (F3.11) | ✅ `disabled={saving \|\| !form.nombre.trim()}` | N/A |
| Marcas (`MarcasManagerDialog.tsx:177`) | Dialog centrado → DrawerForm | toast-only | Nombre 80 ✅ | sin marca | ✅ `disabled={saving \|\| !draftNombre.trim()}` | N/A — **uno de los 2 Dialog sin nombrar, ver §2** |
| Métodos de pago (`PaymentMethodsConfig.tsx`) | DrawerForm ✅ → sin cambio | **inline** (banner de error propio, no toast) — el mejor patrón de error de todo el cluster | sin texto libre persistente | N/A (todo `Switch`/`Select`) | ✅ `disabled={saving}` | Presets fijos (5/10/15/20/Personalizado) — nunca vacíos |
| Horarios de trabajo — sucursal (`HorariosTrabajoSection.tsx`, `QuickApplyCard`) | Card inline (no es un "formulario" de alta/edición clásico) | toast-only | N/A | N/A | ✅ `disabled={applying \|\| ...}` | N/A |
| Horarios de trabajo — por día (`DayEditSheet`, mismo archivo) | **Sheet crudo, autosave instantáneo** → DrawerForm + botón "Guardar" explícito (decisión ya tomada) | toast-only | N/A | N/A | N/A hoy (no hay submit, cada `onChange` persiste solo) — **el botón nuevo debe nacer con guard** | Select de barbero (tab "Por barbero", `:605-623`) queda **mudo** si no hay barberos activos — sin resolver |
| Ausencias/Bloqueos (`BloqueosSection.tsx`) | **Inline en página** (`<div>` togglead por `showForm`, ni Dialog ni Sheet ni DrawerForm) → DrawerForm | toast-only | ❌ Motivo (`:202`) **sin maxLength** — hueco de F3.5, confirmado sigue | "Motivo (opcional)" ✅; fechas/"Aplica a" sin marca | ✅ `disabled={saving}` | "Aplica a" con fallback "Toda la sucursal" ✅ resuelto |
| Comisión por equipo (`ComisionEquipoConfig.tsx`) | Card inline → DrawerForm | toast-only | N/A (`Input` numérico) | sin marca | ❌ "Agregar" regla individual (`:400-404`) sin loading — hueco de F3.4, confirmado sigue; "Agregar todos" SÍ tiene guard (`bulkLoading`) | "No hay barberos disponibles para asignar" ✅ ya resuelto |
| Comisión por productos (`ComisionProductosConfig.tsx`) | Card inline → DrawerForm | toast-only | `maxLength=6` (numérico) | sin marca | ✅ `disabled={isSaving}` | N/A — **no estaba en la lista del pedido, mismo cluster que Comisión equipo, la sumo para no dejar hueco** |
| PINs (`PinConfigSection.tsx`) | Card inline con `<form onSubmit>` semántico (único de la app, F3.9 #15) → ¿DrawerForm? Ver §3 | **inline** ("Los PINs no coinciden") + toast para error de servidor — buen patrón | PIN/Confirmar/Actual: `maxLength=6` ✅ (numéricos) | sin marca en labels (PIN/Confirmar PIN son obviamente obligatorios por contexto, pero no están marcados) | ✅ guard robusto (`isSaving` + longitud + coincidencia) | N/A |
| Editor rápido de línea (`LineQuickEditPopover.tsx`) | Popover → DrawerForm (decisión ya tomada) | toast-only | Nombre 80 ✅ | sin marca | ❌ `handleSave` es async, "Guardar cambios" (`:210-212`) sin loading — hueco de F3.4, confirmado sigue | N/A |

**14 archivos tocarían el contenedor y/o la validación** (contando `ServicesConfig.tsx` y `HorariosTrabajoSection.tsx` una sola vez pese a tener 2 filas cada uno).

### 2. Los 2 Dialog de Configuración que Fase 3 no nombró específicamente

Fase 3 (F3.1) dejó el cluster Configuración en "4 Dialog centrado" pero solo
nombró explícitamente 2 en su prosa (`ProductoDialog.tsx` y el quick-create
de línea de `ServicesConfig.tsx`). Un tercero (`MarcasManagerDialog`) aparece
mencionado de pasada en dos lugares (F3.6, autofocus; y la lista de la
decisión de canon, "ambos MarcasManagerDialog/ServicesConfig quick-create de
línea") pero nunca tuvo su propia línea de auditoría. Identifico los 2 que
faltaban con nombre y línea:

1. **`src/components/productos/MarcasManagerDialog.tsx:177`** — Dialog
   centrado para alta/edición/activación de marcas de producto. Se reusa
   desde **ambos** formularios de Producto: lo importa `ProductosConfig.tsx`
   (contexto `ProductoDialog`, por sucursal) y también `ProductosGlobalConfig.tsx`
   (catálogo global) — un componente, dos puntos de entrada. Tiene guard de
   doble submit y maxLength correctos; solo le falta el contenedor.
2. **`src/components/productos/ProductoPickerDialog.tsx:169`** — Dialog de
   búsqueda + carrito para agregar productos a una venta (`cart`,
   `precio_unitario`, `cantidad`). **No estaba en ningún lado de Fase 3.**
   Ojo: no es exclusivo de Configuración — lo importa también
   `PaymentRegistration.tsx` (Cobrar, cerrado en Tanda 1). Cualquier
   migración de este archivo tocaría el flujo de Cobrar que la CONTEXTO de
   esta parte pidió explícitamente no re-auditar — lo marco como bloqueado
   hasta que se decida si se toca.

No puedo reconstruir con certeza absoluta cuáles 4 Dialog exactos sumó la
pasada original de F3.1 (las notas crudas de esa pasada no quedaron en el
documento, solo el total por cluster) — esto es mi mejor reconstrucción con
evidencia directa del código actual, no una cita textual de Fase 3.

Nota aparte, no un Dialog pendiente: `StockMovementDialog.tsx` (carga/ajuste
de stock) tiene nombre de archivo engañoso — **ya usa `DrawerForm`
internamente** (import en la línea 2). Es higiene de naming, no un desvío de
contenedor.

### 3. Hallazgos nuevos que no encajan en los criterios ya cerrados

1. **Un cuarto tipo de contenedor no contemplado en la decisión de canon.**
   La decisión de Fase 3 habla de migrar "Dialog" y "Sheet crudo" a
   DrawerForm, pero no menciona el patrón que usan `BloqueosSection`,
   `ComisionEquipoConfig`, `ComisionProductosConfig` y `PinConfigSection`:
   un `<div>`/`<Card>` que se despliega **inline, dentro de la misma
   página**, togglead por estado local (`showForm`, `isEditing`) — ni
   modal, ni drawer, ni Sheet. Aplicar "DrawerForm sin excepción" ahí es
   técnicamente posible, pero en PINs y Comisiones el "formulario" ES el
   contenido completo de esa sección de Configuración (no una fila de una
   lista) — abrir un drawer sobre una página que va a quedar vacía detrás
   es una UX distinta a la de Servicios/Líneas/Extras. No lo resuelvo yo:
   ¿el canon aplica también a este cuarto patrón, o "entidad en una lista →
   DrawerForm" no describe estos 4 casos y quedan como excepción legítima
   (como Cobrar y BackfillWizard)?
2. **`ComisionProductosConfig.tsx` no estaba en la lista del pedido** pero
   es el mismo cluster y patrón que `ComisionEquipoConfig.tsx` (mismo
   contenedor inline, mismo `barberId`/`organizationId`/`sucursalId`,
   invocado desde el mismo lugar). Lo sumé a la tabla para no dejarlo
   afuera del build sin que quede documentado.
3. **`ProductoPickerDialog.tsx` es compartido con Cobrar** (ver §2, punto 2)
   — el único caso de esta tanda donde tocar Configuración obligaría a
   tocar (o al menos revisar) un archivo del área cerrada en Tanda 1.

### 4. Estimación de archivos

**14 archivos** para contenedor+validación de la tabla del §1, más
**2 archivos** de los Dialog identificados en §2 (`MarcasManagerDialog.tsx`
es 1 de los 14 ya contados; `ProductoPickerDialog.tsx` sumaría 1 más si se
decide tocarlo pese a ser compartido con Cobrar) → **14-15 archivos**,
sin contar un eventual archivo nuevo compartido si se decide estandarizar
el guard de doble submit en un hook/util común en vez de repetirlo 6 veces
(`ServicesConfig` ×2, `ExtrasConfig`, `DiscountsConfig`, `LinesConfig` edit,
`ComisionEquipoConfig`, `LineQuickEditPopover`).

---

## Fase 4 - Tanda 2 - Build 1 (Catálogo) — 2026-07-13

Primero de 3 builds de la Parte 1 (Configuración). Migra los 4 formularios
de catálogo (ya DrawerForm) de `useState` + `toast.error` a
React Hook Form + Zod, con errores inline vía `ui/form.tsx`
(`FormField`/`FormItem`/`FormLabel`/`FormControl`/`FormMessage`, el wrapper
que existía sin uso desde F3.0). El quick-create "Nueva línea" de
`ServicesConfig.tsx` migra además de contenedor: Dialog centrado → DrawerForm.

### Archivos modificados

- `src/components/config/ServicesConfig.tsx` (formulario principal + quick-create de línea, mismo archivo)
- `src/components/config/LinesConfig.tsx`
- `src/components/config/ExtrasConfig.tsx`
- `src/components/config/DiscountsConfig.tsx`

### maxLength y obligatorio — preservados tal cual

Confirmado campo por campo contra la tabla de la auditoría (Parte 1, §1):
Nombre 80 en los 4 (y en el quick-create de línea); Descripción 240 con
contador de caracteres en Servicios y Líneas (Extras y Descuentos nunca
tuvieron ese campo, no se agregó). Ningún campo obligatorio quedó marcado
con asterisco ni ningún opcional perdió su "(opcional)" — se preservó la
variante 4 ya vigente (nada en los obligatorios) tal como pedías, no se
tocó el criterio. El fallback "Sin línea" del Select de Servicios y los
selects de opciones fijas de Descuentos (Aplica a/Tipo/Redondeo/Método) no
se tocaron.

### Guard de doble submit — parejo y completo en los 4

Los 4 usan ahora `form.formState.isSubmitting` para deshabilitar
Guardar/Guardar cambios (y Cancelar, para no permitir cerrar a mitad de un
guardado) — nada de estado `saving`/`isSaving` implementado a mano. Esto
resuelve la inconsistencia de Líneas (Agregar tenía guard, Editar no: ambos
comparten ahora el mismo `form`) y los guards faltantes de Extras,
Descuentos y el Guardar/Guardar cambios de Servicios.

**Corrección a esta nota (2026-07-13, misma fecha, tras el diagnóstico y el
type-fix posteriores):** acá decía que el guard tenía "una sola microtarea"
de protección real en `ExtrasConfig`/`DiscountsConfig`/`ServicesConfig`/
`LinesConfig.onUpdate`, porque sus props estaban tipadas `=> void`. Eso era
incorrecto. Se verificó contra `useSupabaseData.ts` que las 14 funciones
subyacentes (`addService`/`updateService`/`addExtra`/`updateExtra`/
`addDiscount`/`updateDiscount`/`addLine`/`updateLine` y sus variantes
`*Global`) ya son genuinamente `async` y hacen `await` real contra
Supabase antes de resolver — el tipo `=> void` era solo una anotación de
TypeScript desactualizada, no el comportamiento en runtime (`await` opera
sobre el valor real, no sobre el tipo declarado, que se borra en compilación).
El `await onAdd(...)`/`await onUpdate(...)` de estos 4 archivos ya esperaba
la operación de red completa desde el primer momento. Las firmas de
`MiNegocioGeneralTabContent.tsx`, `SucursalTabContent.tsx` y
`CobrarConfig.tsx` se corrigieron después (mismo día, cambio de solo tipos,
sin lógica) a `Promise<X | null>` / `Promise<void>` para que la anotación
coincida con la realidad. El guard de doble submit de este Build 1 es
completo en los 4 archivos, sin salvedades.

### Validación

`npx tsc --noEmit` — limpio.

---

## Fase 4 - Tanda 2 - Build 2 (Productos + Marcas) — 2026-07-13

Segundo de 3 builds de la Parte 1 (Configuración). Migra los 2 formularios
de Producto (decisión F3.11 ya cerrada: **no se fusionan**, siguen siendo
dos formularios separados por alcance de dato) y `MarcasManagerDialog` a
DrawerForm + RHF/Zod, y unifica la implementación de los 3 campos que
Producto-sucursal y Producto-global comparten (Nombre/Marca/Descripción).

### Archivos modificados

- `src/components/productos/ProductoDialog.tsx` — Dialog con pestañas → DrawerForm (`size="md"`), RHF+Zod completo
- `src/components/productos/ProductosGlobalConfig.tsx` — ya era DrawerForm, migró validación a RHF+Zod
- `src/components/productos/MarcasManagerDialog.tsx` — Dialog → DrawerForm, RHF+Zod
- `src/components/productos/productSharedFields.ts` **(nuevo)** — schema Zod compartido de los 3 campos, según lo que sugería el punto 3 del pedido
- `src/components/ui/drawer-form.tsx` — cambio aditivo: `footer` pasó de requerido a opcional (ver nota abajo)

### Los 3 campos compartidos — unificados en `productSharedFields.ts`

Un único `productSharedFieldsSchema` (Nombre requerido, `trim().min(1).max(80)`,
mensaje `"El nombre no puede estar vacío."` / `"...no puede superar los 80
caracteres."` — el mismo copy que ya usan Servicios/Líneas/Extras/Descuentos
del Build 1, no uno nuevo; Marca como Select con sentinel `'none'` unificado
—`ProductoDialog` usaba `'__none__'`, lo cambié al mismo sentinel que
`ProductosGlobalConfig` ya usaba; Descripción opcional `max(240)` con
contador). `ProductosGlobalConfig` usa el schema tal cual; `ProductoDialog`
lo extiende (`.extend()`) con sus campos exclusivos de sucursal. Ambos usan
ahora `FormLabel` (el mismo componente, vía `ui/form.tsx`) — antes
`ProductoDialog` usaba `<Label>` y `ProductosGlobalConfig` un `<label>` HTML
crudo (F3.11). "(opcional)" quedó en el `<FormLabel>` de Descripción en los
dos (antes solo estaba en el placeholder de `ProductosGlobalConfig`).

### Campos exclusivos de sucursal en ProductoDialog — preservados

Activo-en-esta-sucursal (Switch), Precio costo (opcional), **Precio venta
(único obligatorio de este grupo**, `refine` numérico ≥0), Margen estimado
(solo lectura, derivado en vivo de costo/venta vía `form.watch`), Stock
mínimo, Stock inicial (solo visible en alta o sin vínculo de sucursal, sin
cambios en esa condición), Comisión (modo + porcentaje). Las dos
validaciones cruzadas que antes vivían como `toast.error` dentro de
`handleSave` — porcentaje de comisión personalizada fuera de 0-100, y "sin
precio de costo con comisión activa" — pasaron a `superRefine` con el error
anclado al campo correspondiente (`comisionPct` / `precioCosto`), ahora
inline en vez de toast.

### Pestañas dentro de DrawerForm

No hizo falta ningún cambio estructural en `DrawerForm.tsx` para esto: los
`Tabs`/`TabsList`/`TabsContent` de shadcn son contenido normal, se montan
igual dentro del `children` de `DrawerForm` que dentro de un
`DialogContent`. El indicador rojo por pestaña con error (`submitAttempted`
→ ahora `form.formState.isSubmitted`) y el salto automático a la primera
pestaña con error al fallar el submit (antes manual en `handleSave`, ahora
vía el segundo argumento `onInvalid` de `form.handleSubmit`) se preservaron.

### Cambio aditivo no anticipado en el pedido: `footer` opcional en `DrawerForm`

Lo que sí requirió tocar `drawer-form.tsx` fue otra cosa, no las pestañas:
`MarcasManagerDialog` nunca tuvo una barra de acciones fija al pie (Guardar/
Cancelar viven inline dentro de cada editor, en la lista) — con `footer`
como prop requerida, forzarlo a pasar algo dejaba una franja vacía con
borde superior al fondo del panel. Cambié `footer` a opcional y el wrapper
del pie ahora solo se renderiza si hay contenido. Los demás consumidores
(Build 1 completo + los otros 2 de este build) siguen pasando un `footer`
real, así que su render no cambió — confirmado por `tsc` limpio y por
lectura del diff (el cambio es puramente condicional, aditivo).

### `MarcasManagerDialog` — funciona desde sus 2 puntos de entrada

Se invoca igual desde `ProductosConfig.tsx` (vía el `onManageMarcas` de
`ProductoDialog`, contexto sucursal) y desde `ProductosGlobalConfig.tsx`
directamente (contexto global) — su interfaz de props (`open`, `marcas`,
`onClose`, `onChanged`) no cambió, ninguno de los dos call sites necesitó
ajuste.

### Validación

`npx tsc --noEmit` — limpio.

---

## Fase 4 - Tanda 2 - Build 3a — 2026-07-13

Tercero de los builds de la Parte 1 (Configuración). Migra Métodos de pago,
Ausencias/Bloqueos, Comisión por equipo, Comisión por productos y el editor
rápido de línea a RHF+Zod. Incluye una decisión nueva de esta sesión:
Bloqueos y las 2 Comisiones —hasta ahora "inline en página"— pasan a
comportarse como entidad-en-lista (resumen inline + gestión en DrawerForm),
igual que Servicios. `PinConfigSection.tsx` queda explícitamente fuera,
sin ningún cambio, ni de contenedor ni de validación.

### Archivos modificados

- `src/components/config/PaymentMethodsConfig.tsx` — ya era DrawerForm, migró validación a RHF+Zod
- `src/components/config/BloqueosSection.tsx` — inline-en-página (toggle `showForm`) → DrawerForm, RHF+Zod
- `src/components/config/ComisionEquipoConfig.tsx` — Card inline → resumen inline + DrawerForm, RHF+Zod
- `src/components/config/ComisionProductosConfig.tsx` — Card inline → resumen inline + DrawerForm, RHF+Zod
- `src/components/config/LineQuickEditPopover.tsx` — Popover → DrawerForm, RHF+Zod

### 1. Métodos de pago

Ya tenía el mejor patrón de error del cluster: un banner inline propio
(ícono `AlertTriangle` + texto) para "debe quedar al menos un método
activo", en vez de toast. Se preservó ese nivel exacto — la regla ahora
vive en un `superRefine` (esquema construido con `methodDraftSchema(methods,
editingMethod)`, recalculado en cada render para que capture el `methods`
vigente) anclado al campo `activo`, pero el render del error sigue siendo
el mismo banner con `AlertTriangle`, leído desde
`form.formState.errors.activo`, no el `FormMessage` genérico. El recargo
personalizado (0-100) también se validó por `superRefine`, con
`FormMessage` estándar. Los presets fijos (5/10/15/20/Personalizado) siguen
sin sentinel vacío — no aplica maxLength (no hay texto libre persistente).

### 2. Ausencias/Bloqueos

Contenedor: el botón "Nueva ausencia" ahora abre un `DrawerForm` (antes
mostraba/ocultaba un formulario inline con `showForm`). Validación:
`bloqueoSchema` con Zod — fechas obligatorias, `superRefine` para
"la fecha fin debe ser posterior a la fecha inicio" (antes un `toast.error`
imperativo en `handleCreate`, ahora inline en el campo `fecha_fin`).
**Hueco cerrado:** "Motivo" no tenía `maxLength` — se agregó `maxLength={240}`
más `FormMessage`, mismo límite que el resto de los campos de descripción
del cluster. "Motivo (opcional)" y el fallback "Toda la sucursal" en
"Aplica a" se preservaron sin cambios.

### 3. Comisión por equipo

Contenedor: el bloque que antes se expandía siempre inline (lista de
reglas + mini-formulario de alta + botón de alta masiva) se movió a un
`DrawerForm` sin `footer` (las acciones viven inline en el cuerpo, como
`MarcasManagerDialog`), disparado por un botón "Gestionar reglas" que
aparece junto a un resumen ("N reglas configuradas") en la fila que queda
inline. El toggle activa/inactiva y el botón de eliminar el extra
**siguen inline**, sin cambios — son acciones de un solo paso, no
formularios. El alta de una regla (seleccionar barbero + %) pasó de
validación imperativa (`parseFloat` + `toast.error`) a `addReglaSchema`
(Zod), con error inline en el Select vacío y en el porcentaje fuera de
(0, 100]. El alta masiva ("Agregar todos...") valida el mismo campo de
porcentaje disparando `form.trigger('porcentaje')` contra el mismo
esquema, así que ambos caminos de alta comparten una sola fuente de
validación. El mensaje "No hay barberos disponibles para asignar" se
preservó tal cual, ahora dentro del drawer. **No toqué** la edición inline
de porcentaje por fila (input con `onBlur`/Enter): sigue exactamente igual,
incluido que si el valor no pasa la validación simplemente no guarda sin
avisar — ese comportamiento ya existía antes de este build y no estaba en
el alcance pedido; lo señalo por transparencia, no lo até a esta migración.

### 4. Comisión por productos

Mismo tratamiento que el punto 3: resumen inline (ícono, label, % actual o
botón "Configurar"/"Editar porcentaje", botón eliminar) + `DrawerForm` con
un único campo (`pctSchema`, Zod) para el porcentaje. `maxLength={6}` y el
filtro de caracteres (`replace(/[^\d.,]/g, '')`) se preservaron tal cual,
ahora dentro de un `Controller` (`FormField`) que sigue filtrando en
`onChange` antes de escribir en el form state.

### 5. Editor rápido de línea

Contenedor: `Popover` anclado al botón de lápiz → `DrawerForm` (mismo
patrón de anidamiento ya probado en Build 1: se abre encima del
`DrawerForm` de Servicios que ya está abierto, ambos comparten el mismo
primitivo Radix Dialog por debajo). Validación: `lineQuickEditSchema`
(Nombre `maxLength 80`, antes un `toast.error` imperativo en `handleSave`
para vacío/exceso de largo, ahora `FormMessage` inline). Color y Estado
(Activa/Inactiva) se preservaron como botones/swatches, ahora bindeados
por `Controller` en vez de `useState` local.

### `PinConfigSection.tsx` — sin tocar

No se modificó en absoluto, ni contenedor ni validación, tal como estaba
cerrado como excepción.

### Validación

`npx tsc --noEmit` — limpio.

---

## Fase 4 - Tanda 2 - Confirmación al cerrar (DrawerForm) — 2026-07-13

Implementa la decisión de Fase 3 (canon de contenedor) nunca antes hecha:
cerrar un `DrawerForm` con cambios sin guardar (X, click afuera, Escape)
pide confirmación. El botón "Cancelar" del footer de cada consumidor NO
pasa por esto — sigue cerrando directo, sin preguntar, tal como se decidió.

### Auditoría previa al build (Paso 1)

Se revisó cómo cierra "Cancelar" en los 16 consumidores ya en RHF. **Ninguno
necesitó normalizarse.** En los 16, "Cancelar" llama directo a una función
propia (`closeDrawer()`, `setOpen(false)`, `onClose()`, `() =>
onOpenChange(false)`) — nunca usa `SheetClose`/`DialogClose` ni pasa por el
mecanismo de dismiss de Radix. Como el nuevo intercept vive adentro de
`DrawerForm`, envolviendo el `onOpenChange` que se le pasa a `Sheet`, un
`onClick` que llama la función de cierre directamente nunca lo atraviesa —
bypasea la confirmación automáticamente, sin necesidad de tocar nada en
esos 16 archivos para lograrlo.

### Mecanismo (`drawer-form.tsx`)

Prop nueva opcional `isDirty?: boolean` (default `false`, no rompe a nadie
que no la pase). `DrawerForm` ya no le pasa el `onOpenChange` del consumidor
directo a `Sheet`: lo envuelve en `handleOpenChange`. Si se intenta cerrar
(`next === false`) y `isDirty` es `true`, no cierra — abre un `AlertDialog`
interno ("¿Descartar cambios?", patrón visual estándar de este proyecto
para acciones destructivas) con "Seguir editando" (no hace nada, cierra
solo el `AlertDialog`) y "Descartar cambios" (`variant` destructivo — recién
ahí llama al `onOpenChange(false)` real del consumidor). Si `isDirty` es
`false` o no se pasa, `handleOpenChange` reenvía directo al `onOpenChange`
original — cero cambio de comportamiento respecto a antes de este build.

### Los 16 consumidores conectados (Paso 3)

| Archivo | Instancia de form usada |
|---|---|
| `PaymentMethodsConfig.tsx` | `form` |
| `BloqueosSection.tsx` | `form` |
| `ComisionEquipoConfig.tsx` | `addForm` (el mini-form de alta de regla; el drawer no tiene form propio más allá de este) |
| `ComisionProductosConfig.tsx` | `form` |
| `LineQuickEditPopover.tsx` | `form` |
| `ServicesConfig.tsx` (drawer principal) | `form` |
| `ServicesConfig.tsx` (quick-create línea) | `quickLineForm` |
| `LinesConfig.tsx` | `form` |
| `ExtrasConfig.tsx` | `form` |
| `DiscountsConfig.tsx` | `form` |
| `MarcasManagerDialog.tsx` | `form`, condicionado a `isAdding \|\| !!editingId` (ver nota abajo) |
| `ProductoDialog.tsx` | `form` |
| `ProductosGlobalConfig.tsx` | `form` |
| `agenda/NewAppointmentDialog.tsx` | `form` |
| `agenda/AppointmentDetailDialog.tsx` | `clienteForm`/`turnoForm` combinados (ver nota abajo) |
| `agenda/UnavailableSlotDialog.tsx` | `form` |
| `agenda/DayOffDialog.tsx` | `form` |

**Dos casos no triviales, verificados antes de asumir el nombre `form`:**

- `MarcasManagerDialog.tsx` mantiene el drawer abierto mientras solo se
  navega la lista de marcas (tabs Activas/Inactivas), sin editor visible.
  `isDirty={(isAdding || !!editingId) && form.formState.isDirty}` —
  el `&&` evita que un `form` recién reseteado (o el estado entre una
  edición y la siguiente) dispare el aviso mientras no hay ningún editor
  abierto.
- `agenda/AppointmentDetailDialog.tsx` tiene un solo `DrawerForm` pero dos
  editores inline independientes (`clienteForm` para datos de contacto,
  `turnoForm` para fecha/hora/servicio/profesional), cada uno activable por
  separado (`editingCliente`/`editingTurno`). `isDirty` es la unión de
  ambos, cada uno gateado por si su editor está realmente abierto:
  `(editingCliente && clienteForm.formState.isDirty) || (editingTurno &&
  turnoForm.formState.isDirty)`. **Hueco que dejo señalado, no oculto:** el
  motivo de cancelación (`confirmingCancel`) usa un `useState` de texto
  plano, no RHF — escribir un motivo y cerrar con la X no dispara el aviso.
  Está fuera del alcance de este build (no migra nada a RHF que no lo
  estuviera) y el motivo es opcional y de bajo costo si se pierde, pero
  quedó sin cubrir.

### Los 13 pendientes (no-RHF, no tocados en este build)

Se conectan cuando cada uno migre a RHF en su build correspondiente — no
antes, y no con un `isDirty` calculado a mano como parche.

**Formularios reales (8):** `InviteUserDialog.tsx`,
`config/BarberSucursalesGeneralSection.tsx`, `config/EquipoUnificado.tsx`
(alta/edición de integrante), `StaffPinDialog.tsx`,
`productos/StockMovementDialog.tsx`, `SucursalTabContent.tsx` (drawer
"Editar información"), `config/SucursalesConfig.tsx` (drawer "Nueva/Editar
sucursal"), `config/EquipoSucursalPanel.tsx` (2 drawers: asignación
temporal y recurrente).

**Paneles de solo lectura / historial (5), sin campos que editar — el
concepto de "cambios sin guardar" no aplica:** `CashClosingHistory.tsx`,
`AnulacionesCierreHistory.tsx`, `MultiDayClosingSummary.tsx`,
`TransactionDetailDrawer.tsx`, `productos/ProductoListItem.tsx`.

### Guards existentes que no se tocaron

`EquipoUnificado.tsx:1266` y `SucursalesConfig.tsx:595` bloquean el cierre
mientras hay un guardado en curso (`isSubmitting`) — conviven sin pisarse
con el nuevo mecanismo: ese guard corta el cierre ANTES de que
`handleOpenChange` evalúe `isDirty`, para un problema distinto (no cerrar a
mitad de un guardado). `SucursalTabContent.tsx:205-208` sigue usando su
`isDirty` local solo para deshabilitar el botón de activar/desactivar
sucursal — no se conectó a ningún `DrawerForm`, tal como se pidió.

### Validación

`npx tsc --noEmit` — limpio.

---

## Fase 4 - Tanda 2 - Build 3b (Horarios) — 2026-07-13

Cuarto y último build de la Parte 1 (Configuración). Migra `DayEditSheet`
(el editor por día dentro de `HorariosTrabajoSection.tsx`) de Sheet crudo
con autosave instantáneo a `DrawerForm` + React Hook Form + Zod, con botón
"Guardar cambios" explícito — decisión ya tomada en la sesión del canon
(Fase 3), que este build ejecuta. Resuelve además el select de barbero
mudo detectado en la auditoría de Parte 1.

### Archivo modificado

- `src/components/config/HorariosTrabajoSection.tsx` (único archivo del
  build, por candado de alcance)

### `DayEditSheet` — de autosave a Guardar explícito

Antes: cada `onChange` (Switch de activo, input de hora inicio/fin, alta o
borrado de rango) llamaba a Supabase directamente, sin acumular estado
local ni validar forma. Ahora: `Sheet` crudo → `DrawerForm size="md"`,
estado acumulado en un único `useForm<DayFormValues>` con
`useFieldArray({ name: 'ranges' })` — un rango por fila del array, cada uno
con `dbId` (id real si ya existía en la base, `undefined` si es un rango
nuevo agregado en esta sesión de edición), `hora_inicio`, `hora_fin` y
`activo`. "Agregar rango" y el ícono de papelera ahora solo
`append`/`remove` en el array local — no tocan Supabase hasta que se
confirma "Guardar cambios".

**Validación (`dayFormSchema`, Zod + `superRefine`):** dos reglas, ambas
inline por fila vía `FormMessage`, reemplazando los `toast.error`
imperativos que tenía `updateRange` antes:
- `hora_fin` debe ser mayor que `hora_inicio` de la misma fila (antes:
  `toast.error('La hora fin debe ser mayor que la de inicio')`).
- Ningún rango se superpone con otro del mismo día — mismo algoritmo que
  `hasOverlap` (ordenar por inicio, comparar con el anterior), pero
  reimplementado dentro del `superRefine` para poder anclar el error al
  índice de fila exacto en vez de solo devolver un booleano; el mensaje
  ("Este rango se superpone con otro.") queda en el campo `hora_inicio` de
  la fila que arranca después. `hasOverlap` (la función a nivel de módulo)
  **no se tocó** — sigue siendo la que usa `QuickApplyCard`, sin cambios,
  por el candado de alcance.

**Desvío del comportamiento anterior, señalado y no oculto:** `addRange`
tenía antes un guard imperativo — si el rango auto-calculado (a partir del
fin del último rango existente, +4hs, tope 23:00) no dejaba espacio
(`newStart >= newEnd`), bloqueaba el alta con
`toast.error('No hay espacio para otro rango')` y no agregaba nada. Ahora
el rango se agrega igual al array local, y si resulta inválido lo marca el
mismo mecanismo inline del `superRefine` al intentar guardar (mismo
mensaje de "hora fin debe ser mayor que la de inicio" que cualquier otro
rango inválido). Es un cambio de UX menor (el bloqueo pasa de ser
preventivo a ser detectado al guardar) pero consistente con el criterio
"campo → inline" que pedía esta migración — antes esto era de los pocos
casos de validación de formulario que usaba toast en vez de inline.

**Persistencia al guardar:** `onSubmit` compara el array final contra un
snapshot de los rangos originales tomado al abrir el sheet
(`originalRangesRef`, cargado en el mismo `useEffect` que hace
`form.reset`, gateado por `open && dia` como en los demás consumidores)
y arma 3 lotes: `delete` por los `id` que ya no están en el array final,
`insert` para las filas sin `dbId`, `update` fila por fila para las que
cambiaron `hora_inicio`/`hora_fin`/`activo` respecto del snapshot. Errores
de cualquiera de los 3 → `toast.error('Error al guardar el horario')`
(servidor/red → toast, según el criterio); éxito → `toast.success`,
`onChanged()` (refetch del padre) y cierre del drawer — mismo patrón que
`BloqueosSection.onSubmit`.

**Guard de doble submit y loading:** `disabled={form.formState.isSubmitting}`
en ambos botones del footer, con el label del botón principal alternando
"Guardar cambios" / "Guardando..." — mismo patrón que el resto de los
formularios ya migrados en esta tanda.

**`isDirty` conectado:** `isDirty={form.formState.isDirty}` en el
`DrawerForm`, para que cerrar por X/click afuera/Escape con cambios sin
guardar dispare "¿Descartar cambios?" (antes no aplicaba: con autosave no
existía el concepto de "sin guardar"). El botón "Cancelar" del footer sigue
el mismo patrón que los otros 16 consumidores de la Fase 4 — llama
`onOpenChange(false)` directo, sin pasar por la confirmación. Con este
build, `DayEditSheet` pasa a ser el **17º consumidor** del mecanismo de
confirmación al cerrar (el conteo de "16 consumidores" de la sección
anterior queda como estaba: es una foto de ese build, no se reescribió).

### Select de barbero mudo (tab "Por barbero") — resuelto

`activeBarbers` (nuevo, `barbers.filter(b => b.active)`) reemplaza el
`barbers.filter(b => b.active)` inline que estaba directo en el `.map()`.
Si `activeBarbers.length === 0`, el `Select` se reemplaza por
`EmptySelectHint` (`src/components/agenda/EmptySelectHint.tsx`, importado
cross-carpeta desde `config/`, mismo patrón ya usado por
`AgendaManagement.tsx`) con el mismo mensaje/CTA/acción que
`UnavailableSlotDialog.tsx` usa para el mismo caso ("No hay barberos
activos en esta sucursal." / "Añadir miembro del equipo" /
`toast.message('Abrí Mi Negocio y entrá en Equipo para añadir o activar
barberos.')`) — no se inventó copy nuevo, se reusó el existente.

### `QuickApplyCard` — sin ningún cambio

Confirmado: no se tocó una sola línea del componente ni de su `hasOverlap`
compartido, tal como fijaba el candado de alcance.

### Validación

`npx tsc --noEmit` — limpio.

---

## Cierre de la Parte 1 — Tanda 2: Configuración (2026-07-13)

Los 4 builds de la Parte 1 quedan cerrados:

- **Build 1 (Catálogo):** Servicios, Líneas, Extras y Descuentos (los 4 ya
  eran `DrawerForm`) migraron de `useState` + `toast.error` a RHF+Zod con
  errores inline (`ui/form.tsx`), y el quick-create "Nueva línea" de
  Servicios migró además de contenedor (Dialog → DrawerForm). Guard de
  doble submit parejo en los 4 vía `form.formState.isSubmitting`.
- **Build 2 (Productos + Marcas):** los 2 formularios de Producto (por
  sucursal y global, confirmado que no se fusionan) y
  `MarcasManagerDialog` migraron a DrawerForm + RHF/Zod; los 3 campos que
  comparten Producto-sucursal y Producto-global se unificaron en
  `productSharedFields.ts`. Cambio aditivo no pedido: `footer` de
  `DrawerForm` pasó a ser opcional (lo necesitaba `MarcasManagerDialog`,
  que no tiene barra de acciones fija).
- **Build 3a:** Métodos de pago, Ausencias/Bloqueos, Comisión por equipo,
  Comisión por productos y el editor rápido de línea migraron a RHF+Zod;
  Bloqueos y las 2 Comisiones pasaron de "inline en página" a
  entidad-en-lista (resumen + `DrawerForm`), igualándose al resto del
  cluster. `PinConfigSection.tsx` quedó explícitamente afuera. Mismo build
  en el que se implementó el mecanismo de confirmación al cerrar
  (`isDirty` en `DrawerForm`) y se conectó a los 16 consumidores que ya
  estaban en RHF en ese momento.
- **Build 3b (Horarios):** `DayEditSheet` perdió el autosave instantáneo y
  migró a `DrawerForm` + RHF/Zod con botón "Guardar cambios" explícito —
  la única decisión de esta parte que quitaba una funcionalidad (autosave)
  en vez de sumar validación sobre el mismo comportamiento. Se conectó como
  17º consumidor de `isDirty`. Se resolvió el select de barbero mudo con
  `EmptySelectHint`. `QuickApplyCard` quedó fuera de la migración por
  decisión explícita (no es un formulario de alta/edición clásico).

**Estado final del cluster de Configuración:** los 14 formularios
relevados en la auditoría de Parte 1 (§1) están en `DrawerForm` + RHF/Zod,
con errores de campo inline y errores de servidor/red por toast, guard de
doble submit consistente (`form.formState.isSubmitting`), y — donde aplica
un `DrawerForm` con campos editables — conectados al mecanismo de
confirmación al cerrar. Quedan fuera por decisión explícita:
`PinConfigSection.tsx` (Build 3a) y `QuickApplyCard` (Build 3b, no es un
formulario de entidad). `ProductoPickerDialog.tsx` sigue bloqueado por ser
compartido con Cobrar (Tanda 1, fuera de alcance de esta parte).
