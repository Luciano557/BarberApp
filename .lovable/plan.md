

## Forzar teclado numérico en todos los campos que solo aceptan números

### Problema
En tablets, todos los campos `<Input>` muestran el teclado alfanumérico completo, incluso los que solo aceptan números (precios, montos, PINs, comisiones, cuotas, etc.). Esto ralentiza la carga de datos y genera errores.

### Solución
Agregar `inputMode="numeric"` o `inputMode="decimal"` a cada campo numérico para forzar el teclado numérico en dispositivos táctiles. Mantener `type="text"` con filtro regex en campos PIN (ya lo hacen con `.replace(/\D/g, '')`), y `type="number"` en campos de monto/precio.

---

### Archivos y cambios

**1. `src/components/PinGateDialog.tsx`** — 1 campo PIN
- Agregar `inputMode="numeric"` al Input del PIN (línea 67)

**2. `src/components/StaffPinDialog.tsx`** — 3 campos PIN
- Agregar `inputMode="numeric"` a los 3 Inputs: PIN actual (línea 151), nuevo PIN (línea 182), confirmar PIN (línea 211)

**3. `src/components/PinConfigSection.tsx`** — 3 campos PIN
- Agregar `inputMode="numeric"` a los 3 Inputs: PIN actual (línea 173), nuevo PIN (línea 202), confirmar PIN (línea 230)

**4. `src/components/GastosPanel.tsx`** — 1 campo monto
- Agregar `inputMode="decimal"` al Input de monto (línea 198)

**5. `src/components/SueldosPanel.tsx`** — 1 campo monto
- Agregar `inputMode="decimal"` al Input de monto (línea 557)

**6. `src/components/InversionesPanel.tsx`** — 4 campos numéricos
- Agregar `inputMode="decimal"` a: monto total, meses de amortización, cuotas, monto por cuota

**7. `src/components/DeudasPanel.tsx`** — 3 campos numéricos
- Agregar `inputMode="decimal"` a: monto total, cuotas totales, monto por cuota

**8. `src/components/config/ServicesConfig.tsx`** — 2 campos precio
- Agregar `inputMode="decimal"` a los 2 Inputs de precio

**9. `src/components/config/ExtrasConfig.tsx`** — 2 campos precio
- Agregar `inputMode="decimal"` a los 2 Inputs de precio

**10. `src/components/config/StaffConfig.tsx`** — 1 campo comisión
- Agregar `inputMode="numeric"` (ya tiene `inputMode="numeric"`, confirmar que está bien)

**11. `src/components/config/EquipoUnificado.tsx`** — 1 campo comisión
- Ya tiene `inputMode="numeric"`, sin cambios

**12. `src/components/BackfillWizard.tsx`** — 3 campos numéricos
- Agregar `inputMode="decimal"` a: total efectivo, total MP, cantidad de servicios

**13. `src/components/EstadisticasPanel.tsx`** — 1 campo capacidad diaria
- Agregar `inputMode="numeric"` al Input de capacidad diaria

**14. `src/components/tareas/CustomRepeatSheet.tsx`** — 1 campo intervalo
- Agregar `inputMode="numeric"` al Input de intervalo

**15. `src/components/config/TareasConfig.tsx`** y `src/components/tareas/TareaFormDialog.tsx`** — 1 campo cada uno
- Agregar `inputMode="numeric"` al Input de días personalizado

**16. `src/components/VoidTransactionDialog.tsx`** — ya tiene `inputMode="numeric"`, sin cambios

### Regla de decisión
| Tipo de campo | `inputMode` | Justificación |
|---|---|---|
| PIN (solo dígitos) | `numeric` | Teclado 0-9 sin punto decimal |
| Monto/precio (decimales) | `decimal` | Teclado 0-9 con punto/coma decimal |
| Cantidades enteras | `numeric` | Teclado 0-9 sin punto decimal |
| Comisión % | `numeric` | Ya aplicado |

### Sin cambios en lógica
Solo se agregan atributos HTML `inputMode`. No se modifica ningún handler, validación ni estructura.

