
# Flujo de Productos en Cobrar — Plan v5 (final)

Alcance acotado: `src/components/PaymentRegistration.tsx` y `src/components/productos/ProductoPickerDialog.tsx` (este último solo para sumar el selector de barbero del carrito). No se tocan tablas, RPCs, `useTransactions`, stock, cierres, descuentos, comisiones, anulación ni Mi Negocio > Productos.

## Reglas de negocio

- Producto: puede venderse sin barbero, con barbero, o con barbero + servicio.
- Servicio: siempre requiere barbero.
- Si el carrito está sin barbero, no se puede sumar servicio a esa venta.
- Asignación del carrito = una sola para toda la venta (no por ítem).
- Productos se agregan únicamente desde el paso inicial `barber`.

## Stepper

`barber → service → extras → discount → payment`

Se elimina el step `productos` y el flag `salesOnlyProducts`. El calendario (`DailyTurnosViewer`) se renderiza solo en `barber`.

## Estado nuevo en `PaymentRegistration`

- `cart: CartItem[]`
- `cartBarberId: string | null` — `null` representa "Sin barbero".
- `cartBarberName: string | null`
- `productPickerOpen: boolean`
- `cancelOpen: boolean`

`resetForm()` limpia barbero, servicio, extras, descuento, pagos, `cart`, `cartBarberId`, `cartBarberName` y vuelve a `barber`.

## Paso `barber` — render

1. **Grilla de barberos** (igual a hoy).
2. **Bloque de productos** (siempre visible, debajo de la grilla):
   - Vacío: texto auxiliar corto + botón **"Añadir producto"** (`outline`, `disabled` si falta sucursal).
   - Con items: chip de asignación ("Sin barbero" / "Asignados a: Nombre"), lista editable (nombre, marca, cantidad −/+, subtotal, eliminar), subtotal productos al pie, botón **"Agregar más productos"**, y botón **"Cambiar asignación"** que reabre el diálogo en modo asignación.
3. **Acción "Ir a pago"** (full width, `outline`): visible solo si `cart.length > 0`. No exige servicio. Al tocar, va directo a `payment`.
4. **`DailyTurnosViewer`** (calendario/reservas).

## Paso `barber` — interacciones

- **Tocar barbero con carrito vacío**: comportamiento actual → setea barbero y avanza a `service`.
- **Tocar barbero con carrito + sin asignación (`cartBarberId === null`)**: no avanzar a `service`. `toast.error("Para agregar un servicio, asigná primero la venta a un barbero.")`. (No reasignar silenciosamente; el usuario debe usar "Cambiar asignación" en el carrito.)
- **Tocar barbero con carrito asignado a ese mismo barbero**: setea `selectedBarber` y avanza a `service` (camino D — venta mixta).
- **Tocar barbero distinto al asignado del carrito**: no avanzar. `toast.error("Los productos están asignados a {Barbero actual}. Para continuar con otro barbero, cambiá la asignación del producto o eliminá el carrito.")`.
- **Añadir / Cambiar asignación**: abren `ProductoPickerDialog` con `initialBarberId`/`initialBarberName` y la lista de barberos activos de la sucursal. Al confirmar: `setCart(...)`, `setCartBarberId(...)`, `setCartBarberName(...)`.

## Pasos `service`, `extras`, `discount`

- Sin botón "Añadir producto". Sin botón "Ir a pago".
- Calendario oculto.
- Carrito visible como **resumen compacto de solo lectura** ("X productos · $Y · Asignados a: Nombre / Sin barbero") cuando `cart.length > 0`. No editable (la edición vuelve siendo en `barber`).
- En `handleSelectService`, defensa final: si no hay `selectedBarber` → `toast.error("Para agregar un servicio, primero seleccioná un barbero.")` y abortar.

## Paso `payment`

- Línea de barbero solo si `selectedBarber || cartBarberId` (mostrar el nombre correspondiente). Sin "Venta general de sucursal".
- Si hay servicio: subtotal servicios + extras + descuento (lógica intacta, descuentos solo sobre servicios/extras).
- Si hay productos: bloque de resumen (nombre, cantidad × precio, subtotal por ítem) + subtotal productos. Solo lectura.
- Recargo si aplica + Total a cobrar.
- Calendario oculto.

## Submit (`handleSubmit`)

Sin tocar `useTransactions`. Reglas para armar el payload:

- `hasService = !!selectedService`, `hasProducts = cart.length > 0`.
- Si no hay nada: bloquear.
- Si `hasService && !selectedBarber`: bloquear (no debería pasar por el flujo, defensivo).
- `barberId` final:
  - Si hay servicio → `selectedBarber.id` (siempre presente).
  - Si solo productos → `cartBarberId` (puede ser `null`).
- `barberName`: análogo.
- `productos[]`: mapeo del `cart` al shape `ProductoCartInput` que ya consume `useTransactions`.

Esto encaja con `useTransactions` actual: `tipoVenta` se infiere a `'productos' | 'servicio' | 'mixta'` y el hook acepta `barberId` nullable solo cuando es `'productos'`.

## Cancelar venta

Botón "Cancelar venta" en barra inferior (visible si hay barbero/servicio/extras/descuento/cart). `AlertDialog` de confirmación → `resetForm()`.

## Atajos de teclado

Eliminar la rama `currentStep === 'productos'`. Resto intacto (Ctrl+1-9 selección rápida, Enter, Alt+←/→, Esc).

## Cambios en `ProductoPickerDialog.tsx`

Mínimos y no rompedores:

- Nuevas props opcionales:
  - `barbers?: { id: string; name: string }[]`
  - `initialBarberId?: string | null`
  - `initialBarberName?: string | null`
- Cambio de firma `onConfirm`: `(cart: CartItem[], barberId: string | null, barberName: string | null) => void`. Si `PaymentRegistration` es el único caller (lo es), se actualiza ahí.
- UI: sobre el listado, un control compacto **"Asignar venta a"** con `RadioGroup` o `Select`:
  - Opción default: "Sin barbero".
  - Opciones: barberos activos de la sucursal.
- Sin cambios en lógica de productos, stock, precios ni RLS. La elección viaja en `onConfirm`.

## Flujos válidos cubiertos

```text
A — Solo productos sin barbero
   barber → Añadir producto → Sin barbero → Ir a pago → payment

B — Solo productos con barbero
   barber → Añadir producto → Barbero 1 → Ir a pago → payment

C — Servicio normal
   barber → Barbero 1 → service → extras → discount → payment

D — Producto + servicio (mixta)
   barber → Añadir producto → Barbero 1 → tocar Barbero 1
        → service → extras → discount → payment

E — Producto sin barbero + intento de servicio
   bloqueado: "Para agregar un servicio, asigná primero la venta a un barbero."

F — Producto con Barbero 1 + intento de tocar Barbero 2
   bloqueado: "Los productos están asignados a Barbero 1.
              Para continuar con otro barbero, cambiá la asignación del producto
              o eliminá el carrito."
```

## Detalles técnicos

- Archivos modificados: `src/components/PaymentRegistration.tsx`, `src/components/productos/ProductoPickerDialog.tsx`.
- Sin migraciones. Sin cambios en `useTransactions`, `types/barbershop.ts`, `Index.tsx`.
- Tokens semánticos, dark mode, sin emojis, copy Vittro (claro y operativo). Iconos `Package`, `Plus`, `Minus`, `Trash2`, `User`, `X` de `lucide-react`.
- Componentes: `Button`, `AlertDialog`, `Dialog`, `RadioGroup` o `Select`, `ScrollArea`, `Badge`.

## QA manual

- A, B, C, D, E, F (arriba) — todos esperados.
- Carrito asignado a Barbero 1 → "Cambiar asignación" → "Sin barbero" → tocar Barbero 1 ahora muestra el mensaje del flujo E.
- Volver desde `payment` a `barber` mantiene cart y asignación; calendario reaparece.
- "Cancelar venta" limpia todo (incluyendo `cartBarberId`) y vuelve a `barber`.
- Atajos en `service`/`extras`/`payment` no rompen al no existir step `productos`.
