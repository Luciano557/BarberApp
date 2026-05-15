## Cambios al onboarding: paso "Configuración general"

### Comportamiento

- **Desktop**: el paso 2 actual (`s2_cuenta_intro` — "¿Para qué sirve la cuenta de sucursal?") se mantiene igual. Se agrega un nuevo paso justo después como **paso 3**, que ilumina la tab "General" con el siguiente contenido:
  - Título: `Configuración General`
  - Descripción: `Desde aquí vas a administrar la información general de tu negocio. Los cambios que hagas acá se van a reflejar en todas tus sucursales.`
- **Mobile**: el paso 2 (`s2_cuenta_intro`) se **reemplaza** por el paso de "Configuración General" descrito arriba (mismo título, descripción y target). Es decir, en mobile no se muestra el paso original de "cuenta de sucursal" intro, pero sí el nuevo.
- El resto de los pasos (`s3_cuenta_bullets`, `s4_select_sucursal`, etc.) sigue igual en ambos.

### Implementación

1. **`src/components/MiNegocioPanel.tsx`**: agregar `data-onboarding-id="general-tab"` al `TabsTrigger` con valor `GENERAL_TAB` (línea ~356) para que el nuevo paso pueda apuntarlo.

2. **`src/components/onboarding/steps.ts`**:
   - Extender `OnboardingStep` con un flag opcional `hideOnMobile?: boolean` y `hideOnDesktop?: boolean`.
   - Agregar un nuevo step `s2b_general_tab` justo después de `s2_cuenta_intro`:
     - `targetId: 'general-tab'`
     - `requiredTab: 'mi-negocio'`, `miNegocioSubTab: 'general'`
     - Título y descripción según el pedido.
   - Marcar `s2_cuenta_intro` con `hideOnMobile: true`.
   - (No hace falta `hideOnDesktop` para `s2b_general_tab`; aparece en ambos.)

3. **`src/components/onboarding/OnboardingProvider.tsx`**:
   - Calcular la lista efectiva de pasos según `useIsMobile()` filtrando los `hideOnMobile`/`hideOnDesktop`. Reemplazar todos los usos de `ONBOARDING_STEPS` dentro del provider por esta lista (`steps`), incluyendo `totalSteps`, `currentStep`, persistencia (`current_step` por id), resume por id y `completed_steps`.
   - Como `useOnboarding` se usa también en `OnboardingTooltip`/`OnboardingOverlay`, no cambia la API pública: solo cambia el contenido de la lista y los índices.

### Notas

- En mobile el paso "Configuración General" funciona porque el bottom sheet no depende del `targetRect` para posicionarse; igualmente la tab "General" es visible dentro del panel "Mi Negocio" cuando esa pestaña principal está activa.
- No se tocan migraciones, RLS ni la tabla `user_onboarding`. El campo `current_step` ya guarda el id del paso, no el índice, así que filtrar por dispositivo es seguro.
