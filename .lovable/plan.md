
# Flujo de Productos en Cobrar — Plan v7 (final)

Corregir el flujo: el modal de productos vuelve a su rol original (solo elegir productos). La asignación de la venta (barbero o "Sin barbero") se decide en el paso inicial tocando una tarjeta. Se introduce un estado explícito de tres valores para evitar ambigüedad entre "todavía no decidió" y "eligió Sin barbero".

Alcance: solo `src/components/PaymentRegistration.tsx` y `src/components/productos/ProductoPickerDialog.tsx`. No se tocan tablas, RPCs, hooks, stock, cierres, descuentos, comisiones, anulación ni Mi Negocio > Productos.

## 1. Reglas de negocio

- Producto: sin barbero, con barbero, o con barbero + servicio.
- Servicio: siempre requiere barbero.
- Productos solo se agregan desde el paso `barber`.
- Una sola asignación para toda la venta.

## 2. Estado de asignación

Nuevo estado explícito en `PaymentRegistration`:

```ts
type ProductSaleAssignment = 'pending' | 'no_barber' | 'barber';
const [productSaleAssignment, setProductSaleAssignment] = useState<ProductSaleAssignment>('pending');
```

Se mantienen `cartBarberId` y `cartBarberName`, pero su valor `null` ya no significa "Sin barbero" para la UI: la UI lee `productSaleAssignment`.

Reglas de transición:

- Carrito vacío → `assignment = 'pending'`, `cartBarberId/Name = null`.
- Confirmar productos en el modal → no toca `assignment`. Si era `pending` sigue en `pending`. Si era `barber` o `no_barber` se mantiene.
- Si el carrito queda vacío tras editar → resetear a `pending` y limpiar `cartBarberId/Name`.
- Tocar tarjeta "Sin barbero" → `assignment = 'no_barber'`, `cartBarberId/Name = null`.
- Tocar tarjeta de barbero con carrito → `assignment = 'barber'`, `cartBarberId/Name = barbero`.

## 3. Cambios en `ProductoPickerDialog.tsx`

Quitar toda lógica de barbero:

- Eliminar props `barbers`, `initialBarberId`, `initialBarberName`.
- Eliminar bloque UI "Asignar venta a" (Select + texto auxiliar).
- Eliminar estado `barberId` y el import `Select*`. Quitar `User` si no se usa.
- Cambiar firma: `onConfirm: (cart: CartItem[]) => void`.

El modal queda con: buscador, lista de productos, cantidad, total, confirmar.

## 4. Cambios en `PaymentRegistration.tsx`

### 4.1 Stepper

`barber → service → extras → discount → payment`. Sin cambios. `DailyTurnosViewer` solo en `barber`.

### 4.2 Paso `barber` — render

Orden:

1. Grilla de barberos.
2. Si `cart.length > 0`: tarjeta extra **"Sin barbero"** al final de la grilla. Subtítulo "Solo productos". Estilo coherente con tarjetas de barbero, ícono sobrio (`User` o `Package`), sin emojis. Estado seleccionado (borde `primary`) cuando `assignment === 'no_barber'`.
3. Bloque carrito de productos (si hay items): lista editable con cantidad ±, subtotal por ítem, eliminar, subtotal total, botón "Agregar más productos".
4. Si carrito vacío: botón "Añadir producto".
5. `DailyTurnosViewer`.

Eliminar el botón global "Ir a pago" del paso `barber` y el botón "Cambiar asignación" del bloque carrito. La asignación se cambia tocando la tarjeta correspondiente en la grilla.

El chip de asignación dentro del carrito muestra:

- `assignment === 'pending'`: "Elegí barbero o tocá Sin barbero para continuar".
- `assignment === 'no_barber'`: "Sin barbero".
- `assignment === 'barber'`: "Asignado a {cartBarberName}".

### 4.3 Interacciones en `barber`

**Tocar tarjeta de barbero:**

- Carrito vacío → `setSelectedBarber(id)`, avanzar a `service`. (No tocar `assignment`, sigue `pending`.)
- Carrito con `assignment === 'pending'` → setear `assignment = 'barber'`, `cartBarberId/Name`, `selectedBarber`, avanzar a `service`.
- Carrito con `assignment === 'no_barber'` → setear `assignment = 'barber'`, `cartBarberId/Name`, `selectedBarber`, avanzar a `service`. (Tocar barbero reasigna.)
- Carrito con `assignment === 'barber'` y mismo barbero → `setSelectedBarber`, avanzar a `service`.
- Carrito con `assignment === 'barber'` y otro barbero → toast: *"Los productos están asignados a {Nombre}. Cambiá la asignación tocando ese barbero u otra opción, o cancelá la venta para empezar de nuevo."* Bloquear avance. (Permitir reasignar también es válido; mantenemos el bloqueo para evitar cambios accidentales en venta mixta.)

**Tocar tarjeta "Sin barbero"** (visible solo con `cart.length > 0`):

- `setProductSaleAssignment('no_barber')`, `setCartBarberId(null)`, `setCartBarberName(null)`, `setSelectedBarber('')`.
- Limpiar `selectedService`, `selectedExtras`, `selectedDiscount` (defensivo, no debería haber nada).
- Avanzar al siguiente paso útil. Helper:

```ts
const goToProductsOnlyNextStep = () => setCurrentStep('payment');
```

(Encapsulado para que en el futuro pueda enrutar a un step de descuento de productos.)

### 4.4 Modal — invocación y cierre

`ProductoPickerDialog` se abre desde "Añadir producto" o "Agregar más productos". `onConfirm(cart)`:

- `setCart(cart)`.
- Si `cart.length === 0` → `setProductSaleAssignment('pending')`, `setCartBarberId(null)`, `setCartBarberName(null)`.
- Cerrar modal y permanecer en `barber`.

### 4.5 Paso `service`

Defensa: si no hay `selectedBarber` → toast *"Para agregar un servicio, primero seleccioná un barbero."* y abortar selección.

Nuevo botón **"Ir a pago sin servicio"** (variante `outline`, full width, debajo de la lista de servicios), visible cuando:

```ts
cart.length > 0 && selectedBarber && !selectedService
```

Al tocar:

- `setSelectedService('')`, `setSelectedExtras([])`, `setSelectedDiscount('none')`.
- `setCurrentStep('payment')`.

Resultado: venta de productos con barbero, sin servicio.

### 4.6 Pasos `extras`, `discount`, `payment`

Sin botón "Añadir producto". Carrito visible como resumen compacto de solo lectura (ya implementado para los pasos intermedios).

En `payment`:

- Línea de barbero:
  - Si hay servicio → nombre del barbero del servicio.
  - Si solo productos y `assignment === 'barber'` → `cartBarberName`.
  - Si solo productos y `assignment === 'no_barber'` → **"Sin barbero"**.
- Subtotal servicios + extras (si aplica).
- Descuento (solo sobre servicios/extras).
- Subtotal productos (si aplica).
- Recargo + Total a cobrar.
- Nunca mostrar "Venta general de sucursal".

### 4.7 Submit

`handleSubmit` ya casi soporta el caso. Ajuste:

```ts
const hasService = !!selectedService;
const hasProducts = cart.length > 0;

const finalBarberId = hasService
  ? (barber?.id || '')
  : (productSaleAssignment === 'barber' ? (cartBarberId || '') : '');
const finalBarberName = hasService
  ? (barber ? `${barber.firstName} ${barber.lastName}` : '')
  : (productSaleAssignment === 'barber' ? (cartBarberName || '') : '');
```

Sin cambios en `useTransactions`.

### 4.8 `resetForm`

Agregar `setProductSaleAssignment('pending')` además del reset existente.

### 4.9 Atajos de teclado

En `barber`, los atajos numéricos cubren la grilla. Si la tarjeta "Sin barbero" está visible, ocupa el índice `barbers.length` y dispara el mismo handler que tocarla.

## 5. Flujos cubiertos

```text
A — Solo productos sin barbero
   barber → Añadir producto → confirmar → Sin barbero → payment

B — Solo productos con barbero
   barber → Añadir producto → confirmar → Barbero 1 → service
        → Ir a pago sin servicio → payment

C — Solo servicio
   barber → Barbero 1 → service → extras → discount → payment

D — Producto + servicio (mixta)
   barber → Añadir producto → confirmar → Barbero 1 → service
        → elegir servicio → extras → discount → payment

E — Producto asignado a Barbero 1 + intento de tocar Barbero 2
   bloqueado con toast.
```

## 6. Detalles técnicos

- Archivos: `src/components/PaymentRegistration.tsx`, `src/components/productos/ProductoPickerDialog.tsx`.
- Sin migraciones ni cambios en hooks/types.
- Tokens semánticos, dark mode, sin emojis. Iconos `lucide-react`.
- Componentes shadcn ya presentes.

## 7. QA manual

- A, B, C, D, E (arriba).
- Carrito asignado a Barbero 1 → tocar "Sin barbero" → reasigna a `no_barber` → al tocar Barbero 1 nuevamente reasigna a `barber` y avanza a `service`.
- Volver desde `payment` mantiene cart, asignación y barbero. Calendario reaparece solo en `barber`.
- "Cancelar venta" limpia todo incluyendo `productSaleAssignment`.
- En `service`, "Ir a pago sin servicio" solo aparece con cart + barbero + sin servicio.

## 8. Fuera de alcance

Backend, datos, hooks de transacciones, stock, cierres, descuentos, comisiones, anulación, Mi Negocio > Productos.
