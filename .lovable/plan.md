

## Resumen

Agrupar visualmente los servicios por línea en la pantalla de Cobrar, y agregar un color opcional a cada línea para distinguirlas mejor.

---

## Plan

### 1. Agregar columna `color` a la tabla `lineas`

Migración SQL:
```sql
ALTER TABLE lineas ADD COLUMN color text DEFAULT NULL;
```

### 2. Actualizar el tipo `Line` en `src/types/barbershop.ts`

Agregar `color?: string` a la interfaz `Line`.

### 3. Modificar la pantalla de Cobrar (`PaymentRegistration.tsx`)

En el paso "service" (líneas 348-374), en vez de listar todos los servicios planos:

- Recibir `lines` como prop adicional
- Agrupar servicios por `lineId` (los que no tienen línea van en un grupo "Otros")
- Renderizar cada grupo con un header que muestre el nombre de la línea y una barra lateral o badge con el color de la línea
- Dentro de cada grupo, mostrar los servicios como están ahora

### 4. Pasar `lines` al componente `PaymentRegistration`

Desde `src/pages/Index.tsx` (o donde se renderice), pasar la prop `lines` que ya se carga en `useSupabaseData`.

### 5. Agregar selector de color en la configuración de líneas

En `ServicesConfig.tsx`, cuando se crea o edita una línea, agregar un selector de color (paleta predefinida de 8-10 colores) para que el usuario elija el color de la línea.

### 6. Persistir el color en Supabase

Actualizar `useSupabaseData` para leer/escribir el campo `color` de `lineas`.

---

## Detalle técnico

```text
Paso "Servicio" actual:
  [Corte Clásico - $5000]
  [Corte + Barba - $7000]
  [Corte Deluxe - $8000]
  [Barba Deluxe - $6000]

Paso "Servicio" nuevo:
  ── Essential (barra azul) ──
  [Corte Clásico - $5000]
  [Corte + Barba - $7000]
  
  ── Deluxe (barra dorada) ──
  [Corte Deluxe - $8000]
  [Barba Deluxe - $6000]
```

Paleta de colores predefinida: ~8 opciones (azul, verde, dorado, rojo, violeta, naranja, rosa, gris). Se guardan como hex en la columna `color`.

