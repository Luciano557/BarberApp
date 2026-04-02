

## Problema

Las variaciones del mes actual no se muestran porque `calcVariation` retorna `null` cuando el valor previo es 0. En la comparación "mismos días", si los primeros N días del mes anterior no tuvieron transacciones (o una métrica fue 0), el badge de variación desaparece por completo en vez de mostrar un porcentaje.

**Línea culpable** (116):
```typescript
function calcVariation(current: number, previous: number): number | null {
  if (previous === 0) return current === 0 ? 0 : null;  // ← retorna null, badge no se renderiza
  ...
}
```

## Solución

Modificar `calcVariation` para que cuando `previous === 0` y `current > 0`, retorne un valor representativo en vez de `null`. Opciones razonables:

- Si `previous === 0` y `current > 0`: retornar `100` (indica crecimiento desde cero, o "nuevo")
- Si `previous === 0` y `current === 0`: retornar `0`
- Si `previous === 0` y `current < 0`: retornar `-100`

Esto asegura que siempre se muestre un badge de variación cuando hay datos.

Alternativamente, si se quiere ser más explícito, mostrar un indicador "Nuevo" o "∞" cuando el mes anterior parcial era 0 pero el actual tiene datos.

### Cambio en `src/components/EstadisticasPanel.tsx`

1. **Actualizar `calcVariation`** (línea 115-117): Cuando `previous === 0` y `current !== 0`, retornar `100` (o `-100` si current < 0) en vez de `null`.

2. **Alternativa visual**: En `renderVariationBadge`, si la variación es exactamente `100` y se sabe que el previo era 0, mostrar "Nuevo" en vez de "+100.0%". Esto es opcional pero más claro.

### Archivo a modificar
- `src/components/EstadisticasPanel.tsx` — único archivo afectado

