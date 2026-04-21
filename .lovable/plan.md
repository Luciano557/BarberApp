

## Diagnóstico breve

**Archivos a tocar (4):**
1. `src/components/config/PaymentMethodsConfig.tsx` — UX confusa cuando sucursal hereda general; agregar acceso directo a la config general.
2. `src/components/PaymentRegistration.tsx` — UI hardcodeada Efectivo/MP, sin recargos, sin lista dinámica, submit en formato viejo, label "Mercado Pago" en split.
3. `src/components/SucursalTabContent.tsx` y `src/components/MiNegocioPanel.tsx` — pasar prop `onGoToGeneral` hacia `PaymentMethodsConfig`.
4. `src/pages/Index.tsx` — exponer un callback que abra `Configuración → Mi Negocio` cuando se invoca desde el panel de sucursal.
5. `src/components/config/DiscountsConfig.tsx` — unificar label "Solo Mercado Pago" → "Solo QR".
6. `src/components/PaymentRegistration.tsx` (paso descuentos) — `paymentLabel` para `mercado_pago` debe usar `getMethodLabel` (= "QR"), no "MP".

**Lo que ya estaba bien (no se toca):**
- DB, RLS, seeds, triggers de onboarding.
- `usePaymentMethodsConfig`: resuelve methods, recargos y default sano por ausencia de fila.
- `useTransactions.addTransaction` y `loadTransactionsByDate`: ya aceptan/persisten `basePago`/`recargoPct`/`recargoMonto`/`amount`, y mantienen `total_final` como BASE.
- `useCashClosing`, `getDailySummary`, `SueldosPanel`: intactos. Los dejamos así.
- Tipos `PaymentMethod`, `getMethodLabel` (devuelve "QR" para `mercado_pago`), `TransactionPayment`.
- Historial: las ventas viejas siguen guardando su `metodo_pago` original; al desactivar un método solo se filtra para nuevos cobros, no se altera nada existente.

**Lo viejo / desconectado:**
- `PaymentRegistration`: 2 botones hardcodeados, atajo Ctrl+1/2 fijo, split fijo a `efectivo + mercado_pago`, no calcula recargo, fila "Total" no incluye recargo, `onSubmit.payments` manda solo `{method, amount}`.
- `PaymentRegistration` paso "discount": etiqueta "MP" hardcodeada en chip "Solo MP".
- `PaymentMethodsConfig`: cuando sucursal hereda general muestra grilla gris confusa.
- `DiscountsConfig`: `<SelectItem>` dice "Solo Mercado Pago".

---

## Cambio 1 — `PaymentMethodsConfig.tsx`

Sin cambios de lógica de DB. Solo claridad y CTA.

**Nueva prop opcional:** `onGoToGeneral?: () => void`.

**Header:**
- Título: `Métodos de pago y recargos`.
- Subtítulo dinámico:
  - `editingGeneral` → "Configuración general del negocio".
  - sucursal + hereda → "Esta sucursal usa la configuración general".
  - sucursal + override → "Esta sucursal tiene configuración propia".
- Switch a la derecha solo si `sucursalId !== null`. Label clarificador: "Usar configuración general" (sigue igual) + tooltip/hint debajo: "Activado: hereda de Mi Negocio. Desactivado: configuración propia."

**Body:**

A. `sucursalId !== null && usarGeneral === true` (HEREDA):
- **No renderizar la grilla**.
- Estado vacío con `Building2` + texto:
  - Título: "Esta sucursal usa la configuración general"
  - Detalle: "Los métodos de pago activos y los recargos se administran desde Mi Negocio. Cualquier cambio se aplica acá automáticamente."
- Dos botones lado a lado:
  - Primario `Button` "Ir a configuración general" → llama `onGoToGeneral?.()`. Solo se renderiza si la prop está provista.
  - Secundario `outline` "Personalizar esta sucursal" → `handleToggleUsarGeneral(false)`.

B. `editingGeneral` o `editingOverride`:
- Si `editingOverride`: banner sutil arriba de la grilla con `Info` icono: "Esta sucursal tiene configuración propia. Los cambios acá NO afectan a las demás sucursales." + acción inline "Volver a usar la configuración general" → `handleToggleUsarGeneral(true)`.
- Renderizar la grilla actual de 5 métodos con switch + recargo % + Guardar (sin cambios).

---

## Cambio 2 — Conectar el CTA "Ir a configuración general"

`MiNegocioPanel` y `SucursalTabContent` no manejan tabs globales. La config general vive en `Configuración → Mi Negocio (OrganizationSettings)` (panel `config`).

**Estrategia simple:**
- `Index.tsx`: agregar callback `goToGeneralConfig = () => setActiveTab('config')` y pasarlo como prop al panel actual de Mi Negocio (a través de `MiNegocioPanel`).
- `MiNegocioPanel`: aceptar `onGoToGeneralConfig?: () => void` y propagarla a `SucursalTabContent`.
- `SucursalTabContent`: aceptar `onGoToGeneralConfig?` y pasarla a `<PaymentMethodsConfig onGoToGeneral={onGoToGeneralConfig} />`.
- En `OrganizationSettings`, `<PaymentMethodsConfig sucursalId={null} />` no recibe la prop (no aplica).

Resultado: al tocar "Ir a configuración general" desde un tab de sucursal, el usuario aterriza en `Configuración → Mi Negocio`, donde edita la fila general y vuelve.

(El detalle de scroll a la sección de métodos de pago se omite para no inflar el alcance; quedará visible debajo del card de organización.)

---

## Cambio 3 — `PaymentRegistration.tsx` (selector dinámico + recargos)

### 3.1 Hook + estado
- Importar `usePaymentMethodsConfig`, `getMethodLabel`.
- `const { methods, getRecargoPct, loading: methodsLoading } = usePaymentMethodsConfig();` (sin args → sucursal activa, default sano).
- `const activeMethods = useMemo(() => methods.filter(m => m.activo), [methods]);`
- `const electronicMethods = useMemo(() => activeMethods.filter(m => m.method !== 'efectivo'), [activeMethods]);`
- Nuevo estado: `const [selectedDigitalMethod, setSelectedDigitalMethod] = useState<PaymentMethod | ''>('')` para el split.
- Inicializarlo cuando cambia `electronicMethods`: si `mercado_pago` está activo usalo; si no, `electronicMethods[0]?.method`; si no hay, `''`.

### 3.2 Render de selector simple (no split)
- Reemplazar los 2 botones hardcodeados por `activeMethods.map((m, idx) => …)` en `grid grid-cols-2 md:grid-cols-3 gap-3`.
- Cada botón: ícono `Banknote` si `m.method === 'efectivo'`, sino `CreditCard`. Label `m.label`. Atajo `idx+1` arriba-izquierda. Si `m.recargoPct > 0`: chip sutil "+{m.recargoPct}%" abajo del label.
- Estilos: efectivo usa `border-success`/`bg-success/5` cuando seleccionado; resto `border-secondary`/`bg-secondary/5`.
- Botón "Combinar métodos de pago": deshabilitado si no hay efectivo activo o no hay `electronicMethods`. Tooltip si está deshabilitado: "Activá efectivo y al menos un método electrónico en Mi Negocio".

### 3.3 Render del split
- Mantener layout 2 columnas. Columna izquierda fija = Efectivo (`Banknote`). Columna derecha = el método electrónico seleccionado (`CreditCard`), con label `getMethodLabel(selectedDigitalMethod)`.
- Si `electronicMethods.length > 1`: arriba del input derecho, chips selector horizontal con cada electrónico activo (label vía `getMethodLabel`, click → `setSelectedDigitalMethod(m)`).
- Junto a cada `CurrencyInput`, si su método tiene recargo > 0: texto pequeño `→ ${cobrado.toLocaleString()}` debajo (donde `cobrado = Math.round(monto * pct/100) + monto`).
- `splitValid` sigue comparando suma de **bases** vs `total`.

### 3.4 Cálculo de recargo
```
const pctSimple = paymentMethod ? getRecargoPct(paymentMethod) : 0;
const pctEfectivo = getRecargoPct('efectivo');
const pctDigital = selectedDigitalMethod ? getRecargoPct(selectedDigitalMethod) : 0;

const recargoTotal = useMemo(() => {
  if (splitMode) {
    return Math.round(splitEfectivoNum * pctEfectivo / 100)
         + Math.round(splitMpNum     * pctDigital / 100);
  }
  return Math.round(total * pctSimple / 100);
}, [...]);

const totalACobrar = total + recargoTotal;
```

### 3.5 Resumen visible (Card)
Después del bloque de descuento:
```
Recargo (QR 10%)        +$X.XXX     ← solo si recargoTotal > 0
─────────────────────────────────
Total a cobrar           $totalACobrar
```
- Reemplazar `<span>Total</span>$total` por `<span>Total a cobrar</span>$totalACobrar`.
- Si `recargoTotal === 0`, `totalACobrar === total` y la fila Recargo no se renderiza → comportamiento visual idéntico al actual.
- En modo simple, etiqueta del recargo: `"Recargo (${getMethodLabel(paymentMethod)} ${pctSimple}%)"`.
- En split: si ambos pcts > 0 → "Recargo (mixto)"; si uno → mostrar el específico.
- No agregar fila "Base".

### 3.6 `onSubmit` — formato extendido

Ampliar tipo en `PaymentRegistrationProps.onSubmit.payments`:
```ts
payments?: { method: PaymentMethod; amount: number; basePago: number; recargoPct: number; recargoMonto: number }[];
```

En `handleSubmit`:
- Modo simple:
  ```ts
  const recargoMonto = Math.round(total * pctSimple / 100);
  payments = [{ method: paymentMethod, basePago: total, recargoPct: pctSimple, recargoMonto, amount: total + recargoMonto }];
  ```
- Modo split:
  ```ts
  const recE = Math.round(splitEfectivoNum * pctEfectivo / 100);
  const recD = Math.round(splitMpNum     * pctDigital / 100);
  payments = [
    { method: 'efectivo',             basePago: splitEfectivoNum, recargoPct: pctEfectivo, recargoMonto: recE, amount: splitEfectivoNum + recE },
    { method: selectedDigitalMethod,  basePago: splitMpNum,       recargoPct: pctDigital,  recargoMonto: recD, amount: splitMpNum + recD },
  ];
  ```
- `primaryMethod`: el de mayor `basePago`.
- `total` que se manda al `onSubmit` sigue siendo la BASE (intacto). `useTransactions` ya lo respeta.

### 3.7 Atajos de teclado
Reemplazar el `if index===0/===1` por:
```ts
} else if (currentStep === 'payment' && activeMethods[index]) {
  handleSelectPayment(activeMethods[index].method);
}
```

### 3.8 Self-healing al cambiar config (Cambio 4 del usuario)
`useEffect` que observa `activeMethods`:
- Si `paymentMethod` ya no está en `activeMethods.map(m => m.method)` (y no estamos en split): `setPaymentMethod('')` (silencioso, no toast).
- Si `splitMode === true` y `selectedDigitalMethod` ya no está en `electronicMethods`: si hay otro electrónico activo, seleccionarlo; si no, `cancelSplitMode()`.
- Si `splitMode === true` y `efectivo` se desactiva: `cancelSplitMode()`.

Esto no altera ventas anteriores; solo limpia la selección del formulario abierto.

### 3.9 Loading / fallback
- Si `methodsLoading`: en el paso de pago, mostrar `Loader2` chico arriba del grid.
- Si `activeMethods.length === 0`: mensaje en el grid: "No hay métodos de pago activos. Activá al menos uno en Mi Negocio."

### 3.10 Toast y label histórico
- Toast: si `recargoTotal > 0`, description = `"$${totalACobrar.toLocaleString()} (incluye recargo $${recargoTotal.toLocaleString()})"`. Si no, comportamiento actual.
- En el chip de descuentos restringido (`paymentLabel`), reemplazar el ternario hardcodeado:
  ```ts
  const paymentLabel = discount.paymentMethod === 'todos' ? '' : getMethodLabel(discount.paymentMethod as PaymentMethod);
  ```
  → muestra "QR" en vez de "MP".

---

## Cambio 4 — `DiscountsConfig.tsx`

Cambio cosmético en el `<Select>`:
- `<SelectItem value="mercado_pago">Solo Mercado Pago</SelectItem>` → `<SelectItem value="mercado_pago">Solo QR</SelectItem>`.

(El valor interno sigue siendo `mercado_pago` por compatibilidad histórica; solo cambia el label visible.)

---

## Lo que NO se toca

- `useTransactions.ts`, `useCashClosing.ts`, `getDailySummary`: 0 cambios.
- `SueldosPanel`, comisiones, bono fijo, `MultiDayClosingSummary`: 0 cambios.
- DB, migraciones, RLS, seeds: 0 cambios.
- Ventas históricas: ningún update; quedan tal cual.
- `DailySummary.tsx` (etiquetas "Mercado Pago" en cierres) y otros lugares de historial: fuera de alcance del pedido. Se atacan en una pasada cosmética separada si el usuario lo pide.

---

## Verificación post-cambio

1. **Configuración por sucursal heredando**: aparece estado vacío con "Esta sucursal usa la configuración general" + botones "Ir a configuración general" (lleva a `config → Mi Negocio`) y "Personalizar esta sucursal".
2. **Toggle a personalizado**: aparece banner "Configuración propia" con acción para volver a heredar + grilla editable.
3. **Cobrar → paso Método de pago**: 5 tarjetas (Efectivo, QR, Transferencia, Débito, Crédito) cuando todas están activas. Si una se desactiva, deja de aparecer.
4. **Recargo en QR (10%)**: al elegir QR aparece fila "Recargo (QR 10%) +$X" y "Total a cobrar" mayor que "Total".
5. **Split Efectivo + QR con recargo**: chip selector de método electrónico si hay más de uno; texto "→ $cobrado" debajo del input QR; total a cobrar correcto.
6. **Submit**: `venta.total_final` = BASE; `venta.recargo_total`/`total_cobrado` con valores correctos; `venta_pagos` con `base_pago`/`recargo_pct`/`recargo_monto`; `ingresos.sueldo` igual que antes.
7. **Atajos Ctrl+1..N**: seleccionan según el orden visible.
8. **Auto-limpieza**: si en otra pestaña se desactiva el método elegido, el formulario abierto limpia la selección sin tocar historial.
9. **Etiquetas**: en descuentos (chip "Solo QR" y selector "Solo QR") y en cobro: nunca aparece "MP" ni "Mercado Pago".

