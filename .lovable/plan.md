

## Corregir cálculo de sueldo fijo para que sea exacto por mes calendario

### Problema
El cálculo actual usa `sueldoFijo / 30 * días`, lo que genera variaciones:
- Febrero (28 días): devenga $140.000 en vez de $150.000
- Marzo (31 días): devenga $155.000 en vez de $150.000

### Solución
Cambiar la lógica en `SueldosPanel.tsx` para contar **meses completos + fracción proporcional del mes actual**:

1. Desde `created_at` hasta hoy, contar cada mes calendario completo como exactamente `$150.000`
2. Para el mes parcial actual (o el primer mes si recién arrancó), calcular proporcionalmente con los días reales de ese mes: `sueldoFijo * (díasTranscurridos / díasTotalesDelMes)`

### Ejemplo con Agus Community (created_at = 15 feb)
- Feb: 13 días de 28 → $150.000 × 13/28 = $69.643
- Mar: mes completo (si ya pasó el 15) → $150.000
- Resultado: ~$219.643 (más preciso al mes calendario real)

**Nota**: Con esta lógica, el devengado de Agus ya no dará exactamente $225.000 porque febrero tiene 28 días, no 30. El cálculo anterior asumía 30 días fijos. Si querés mantener los $225.000 exactos para Agus, habría que ajustar su `created_at` después de aplicar el cambio.

### Cambios técnicos
- **Archivo**: `src/components/SueldosPanel.tsx`
- **Líneas afectadas**: ~340-344 (devengado filtrado) y ~350-354 (devengado histórico)
- Se reemplaza `(fixedSalary / 30) * días` por una función helper que itere mes a mes sumando el monto exacto mensual, con prorrateo solo en el primer y último mes parcial
- Se usa `getDaysInMonth()` de `date-fns` para obtener los días reales de cada mes

