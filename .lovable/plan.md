## Problema

Del paso 2 al 8 no se ilumina nada porque los `data-onboarding-id` apuntados por `steps.ts` o no existen, o están en una tab no activa (la sub-tab "General" vs sucursal de Mi Negocio nunca se conmuta), y no hay un paso intermedio para "elegir sucursal".

## Cambios

### 1. `src/components/onboarding/steps.ts` — reescribir secuencia (8 pasos)

| # | id | targetId | sub-tab Mi Negocio | Tooltip |
|---|---|---|---|---|
| 1 | `s1_sidebar` | `mi-negocio-nav` | — | (sin cambios) |
| 2 | `s2_cuenta_intro` | `cuentas-sucursal-section` | `__general__` | "¿Para qué sirve la cuenta de sucursal?" + descripción |
| 3 | `s3_cuenta_bullets` | `cuentas-sucursal-bullets` | `__general__` | "¿Para qué sirve la cuenta de sucursal?" + 3 bullets |
| 4 | `s4_select_sucursal` | `sucursal-tab` | `__general__` (no fuerza nada) | "Accede a tu sucursal principal". Avanza al hacer click en una tab de sucursal (no botón "Continuar") |
| 5 | `s5_info` | `info-sucursal-card` | primera sucursal | "Información de la sucursal. Acá podés configurar y gestionar toda la información principal de esta sucursal." |
| 6 | `s6_equipo` | `equipo-section` | primera sucursal | "Gestioná tu equipo. Acá podés agregar barberos, encargados, cajeros y miembros del equipo." |
| 7 | `s7_catalogo` | `catalogo-section` | primera sucursal | "Servicios, Extras y productos. Acá podés configurar los servicios, extras, productos y descuentos particulares de la sucursal." |
| 8 | `s8_pagos` | `metodos-pago-section` | primera sucursal | "Métodos de pago. Configurá los medios de pago disponibles para esta sucursal." |

Agregar a `OnboardingStep` los campos opcionales:
- `miNegocioSubTab?: 'general' | 'first-sucursal'`
- `advanceOnEvent?: 'mi-negocio:sucursal-selected'`
- `hideContinueButton?: boolean` (true para s4)

Todos los pasos 2–8 mantienen `requiredTab: 'mi-negocio'`.

### 2. `src/components/onboarding/OnboardingProvider.tsx`

- Nuevo registro: `registerSubTabSetter(fn)` y `notifySubTabChange(value)` (paralelo a `tabSetterRef`).
- En cada cambio de paso, si `currentStep.miNegocioSubTab` está definido, llamar al sub-tab setter:
  - `'general'` → `__general__`
  - `'first-sucursal'` → id de la primera sucursal visible (lo resuelve `MiNegocioPanel` registrando un setter ya parametrizado).
- Nuevo método `notifyEvent(name)`: si `currentStep.advanceOnEvent === name`, llama `next()`.
- Exponer ambos en el contexto.

### 3. `src/components/MiNegocioPanel.tsx`

- `useOnboarding()` para registrar:
  - `registerSubTabSetter((kind) => { if (kind==='general') handleTabChange(GENERAL_TAB); else if (kind==='first-sucursal' && visibleSucursales[0]) handleTabChange(visibleSucursales[0].id); })`
- En `handleTabChange`, después de cambiar la tab, llamar `onb.notifyEvent('mi-negocio:sucursal-selected')` cuando `value !== GENERAL_TAB`.
- Añadir `data-onboarding-id="sucursal-tab"` al primer `TabsTrigger` de sucursal (la "Casa Central").

### 4. `src/components/config/CuentasSucursalConfig.tsx`

- `data-onboarding-id="cuentas-sucursal-section"` en el `<Card>` raíz.
- `data-onboarding-id="cuentas-sucursal-bullets"` en el `<div className="space-y-2.5">` que envuelve los 3 `InfoRow`.

### 5. `src/components/onboarding/OnboardingTooltip.tsx`

- Renderizar `step.bullets` como lista debajo de la descripción (ya soportado en steps.ts pero hay que confirmar el render).
- Si `step.hideContinueButton`, ocultar el botón "Continuar" y mostrar texto sutil "Elegí una sucursal para continuar".

### 6. Edge cases

- Si no hay sucursales visibles cuando llega el paso 4, igual se muestra el target sobre la primera; si no existe, el overlay queda con fallback de pantalla completa hasta que aparezca (ya implementado).
- Cierre y reapertura: `current_step` ya persiste por id; los nuevos ids reemplazan los viejos. Usuarios con un onboarding a medio camino sobre ids viejos caerán al paso 0 si el id no se encuentra (comportamiento de `findIndex` ya existente).

## Fuera de alcance

- No se toca DB ni `useOnboardingState`.
- No se modifican los componentes de Equipo, Servicios o Métodos de pago: ya tienen los `data-onboarding-id` correctos en `SucursalTabContent.tsx`.
