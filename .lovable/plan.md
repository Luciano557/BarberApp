

## Resumen

Crear un componente `CurrencyInput` reutilizable que formatee montos en tiempo real con separador de miles argentino (`.`) y decimales (`,`), manteniendo el valor numérico limpio internamente.

---

## Plan

### 1. Crear componente `src/components/ui/currency-input.tsx`

Un wrapper de `<Input>` que:
- Acepta `value: number | string` (valor numérico limpio) y `onChange: (value: string) => void` (devuelve string numérica limpia, ej: `"1250000"` o `"1250000.50"`)
- Muestra el valor formateado con `toLocaleString('es-AR')` (miles con `.`, decimales con `,`)
- Al escribir, filtra solo dígitos y `,` → convierte internamente `,` a `.` para el valor limpio
- Usa `type="text"` con `inputMode="decimal"` para teclado numérico en mobile sin restricciones de `type="number"`
- Acepta todas las props de Input (placeholder, className, etc.)

Lógica clave:
```
Input del usuario: "1234567" → Muestra: "1.234.567" → Valor interno: "1234567"
Input del usuario: "1234567,50" → Muestra: "1.234.567,50" → Valor interno: "1234567.50"
```

### 2. Reemplazar inputs de dinero en todos los formularios

Archivos a modificar (solo los inputs de montos/precios, NO los de cantidades/días/cuotas numéricas):

- `GastosPanel.tsx` — campo "Monto"
- `InversionesPanel.tsx` — "Monto total", "Monto por cuota"
- `DeudasPanel.tsx` — "Monto total", "Monto por cuota"
- `SueldosPanel.tsx` — campo "monto"
- `BackfillWizard.tsx` — campos de efectivo y digital
- `ServicesConfig.tsx` — campos "Precio"
- `ExtrasConfig.tsx` — campos "Precio"
- `EquipoUnificado.tsx` — "Sueldo fijo mensual"

Cada reemplazo: cambiar `<Input type="number" ...>` por `<CurrencyInput ...>`. El `parseFloat` en submit sigue funcionando porque el value ya es numérico limpio.

### 3. Formatear montos en la visualización existente

Los `toLocaleString('es-AR')` que ya existen en tablas/listados seguirán funcionando igual — no requieren cambios.

---

## Detalle técnico

- NO se cambian inputs de cantidades (cuotas, días, intervalos) — solo montos de dinero
- El componente maneja el cursor position para evitar saltos al formatear
- Se permiten máximo 2 decimales

