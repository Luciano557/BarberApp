## Cambio visual: fila "Productos" consistente en todas las tarjetas

### Archivo único
`src/components/DailySummary.tsx`

### Pasos

1. Antes del `return` (o justo antes del `.map((barber) => ...)` en la sección "Cierre por Barbero", línea ~498), calcular una bandera global:

```ts
const shouldShowProductsRow = barberSummaries.some(b => (b.productosTotal ?? 0) > 0);
```

2. Reemplazar la condición individual de la línea 533:

```tsx
{barber.productosTotal > 0 && (
```

por:

```tsx
{shouldShowProductsRow && (
```

3. Dentro de esa fila, usar `barber.productosTotal || 0` al renderizar el monto, para que los barberos sin ventas de productos muestren `$0`.

### Fuera de alcance
Cálculo de comisión, total, `productosTotal`, guardado de cierre, `ingresos_items_productos`, flujo de cobro, stock, RLS y edge functions permanecen intactos.