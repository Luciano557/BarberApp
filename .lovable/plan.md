

## Resumen del problema

Hay dos errores en la pantalla de Resúmenes que afectan lo que el usuario ve:

1. **El estado "Caja Cerrada" de cada barbero puede quedar desactualizado.** La función que revisa qué barberos cerraron caja no se actualiza cuando cambiás de sucursal. Usa la sucursal anterior, entonces puede mostrar que un barbero cerró caja cuando en realidad no lo hizo (o al revés). Esto no pierde datos, pero muestra información incorrecta.

2. **El botón de Historial aparece duplicado.** Hay dos componentes idénticos en las líneas 389 y 390. Esto genera una doble consulta a la base de datos y puede causar comportamiento visual raro.

---

## Detalle técnico

### Cambio 1: `src/components/DailySummary.tsx` — línea 132

Agregar `currentSucursal` a las dependencias:

```
}, [validDate, organization?.timezone, currentSucursal]);
```

### Cambio 2: `src/components/DailySummary.tsx` — línea 390

Eliminar la línea duplicada de `<CashClosingHistory>`.

### Archivos a modificar
- `src/components/DailySummary.tsx` — dos cambios puntuales

