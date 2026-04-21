

## Plan: Separar configuración general de métodos de pago en su propia sección

### Diagnóstico

Hoy la configuración general de métodos de pago vive **embebida dentro de `OrganizationSettings`** (panel "Plan y Suscripción"). El botón "Ir a configuración general" desde una sucursal manda al **menú raíz de Configuración**, no a un lugar concreto. Resultado: navegación ambigua y UX confusa.

### Archivos a tocar

1. **`src/components/config/ConfigMenu.tsx`** — agregar nueva entrada "Métodos de pago y recargos".
2. **`src/components/ConfigurationPanel.tsx`** — agregar sección `'payments'` que renderiza `PaymentMethodsConfig` con `sucursalId={null}`. Aceptar prop opcional `initialSection` para deep-link.
3. **`src/components/OrganizationSettings.tsx`** — **quitar** `<PaymentMethodsConfig sucursalId={null} />` (deja de vivir acá). Plan y Suscripción queda solo con datos del negocio + plan.
4. **`src/pages/Index.tsx`** — exponer estado `configInitialSection`. El callback `onGoToGeneralConfig` que se pasa a Mi Negocio ahora hace `setConfigInitialSection('payments'); setActiveTab('config')`. `ConfigurationPanel` recibe `initialSection`.
5. **`src/components/config/PaymentMethodsConfig.tsx`** — pequeños retoques de copy en estado heredado:
   - Botón primario pasa a llamarse **"Editar configuración general"** (el usuario lo pidió textual).
   - Sin cambios de lógica.

### Cómo queda la navegación

- **Configuración → Métodos de pago y recargos** — nueva entrada del menú principal de Configuración. Subtítulo: "Configuración general del negocio". Renderiza `<PaymentMethodsConfig sucursalId={null} />`.
- **Mi Negocio → sucursal X**, botón "Editar configuración general" → abre directo `Configuración → Métodos de pago y recargos` (no el menú raíz).
- **Configuración → Plan y Suscripción** — vuelve a contener solo los datos del negocio y del plan. Limpio.

### Ficha de sucursal — estado HEREDA general

Sin cambios estructurales (ya está bien implementado). Solo:
- Texto: "Esta sucursal usa la configuración general del negocio. Los métodos activos y los recargos se administran en un solo lugar."
- Botón primario: **"Editar configuración general"** (icon `Settings` + flecha).
- Botón secundario: **"Personalizar esta sucursal"** (outline). Al click → toggle off + aparece la grilla.
- Sin grilla gris.

### Ficha de sucursal — estado OVERRIDE propio

Sin cambios. Banner sutil arriba: "Esta sucursal tiene configuración propia. Los cambios acá no afectan a las demás." + acción inline "Volver a usar la configuración general". Debajo, la grilla editable de los 5 métodos.

### Navegación directa: cómo se resuelve

`Index.tsx` mantiene un estado adicional:
```text
configInitialSection: 'menu' | 'payments' | …
```

Al pulsar "Editar configuración general" desde una sucursal:
1. `setConfigInitialSection('payments')`
2. `setActiveTab('config')`

`ConfigurationPanel` lee `initialSection` como prop y arranca en esa sección directa, no en el menú. Si el usuario abre Configuración por el sidebar, `initialSection` es `undefined` y arranca en `menu` como hoy.

### Lo que NO se toca

- DB, RLS, hooks (`usePaymentMethodsConfig`, `useTransactions`, `useCashClosing`).
- `SueldosPanel`, cierres, historial, comisiones.
- `venta.total_final` sigue siendo BASE; `recargo_total` y `total_cobrado` intactos.
- `PaymentRegistration` (ya migrado en pasos previos).
- Modelo de 5 métodos. Métodos desactivados siguen apareciendo en historial/cierres.
- Etiqueta "QR" (ya está aplicada).

### Verificación

1. **Sidebar → Configuración**: aparece nueva tarjeta "Métodos de pago y recargos" entre Plan y PIN.
2. **Configuración → Métodos de pago y recargos**: muestra `PaymentMethodsConfig` con la grilla general editable (5 métodos, recargos, switches).
3. **Configuración → Plan y Suscripción**: ya NO muestra métodos de pago. Solo datos del negocio + plan.
4. **Mi Negocio → sucursal heredando**: bloque sin grilla, con botón "Editar configuración general" + "Personalizar esta sucursal".
5. **Click en "Editar configuración general"**: aterriza directo en `Configuración → Métodos de pago y recargos`. No se ve el menú intermedio.
6. **Mi Negocio → sucursal con override**: banner + grilla editable de la sucursal.
7. **Etiquetas**: en toda la UI sigue diciendo "QR", nunca "Mercado Pago" / "MP".

