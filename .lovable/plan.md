## Cambios al Onboarding

### 1. Restringir audiencia a Dueño y Encargado General

- En `src/components/onboarding/OnboardingProvider.tsx`, reemplazar la condición de auto-start (`if (isLoading || !isOwner) return`) por una que combine `isOwner || isGeneralManager`.
- Exponer `isGeneralManager` desde `useOnboardingState` (lo lee de `useAuth`) o consumir `useAuth` directo en el provider.
- Mismo gating para el botón "Ver tutorial otra vez" en `src/components/config/ConfigMenu.tsx`: mostrarlo si es dueño o encargado general (hoy solo `isOwner`).
- Cualquier otro rol (manager de sucursal, barbero, cuenta de sucursal, etc.) nunca dispara el onboarding ni ve el botón de reinicio.

### 2. Pantalla de bienvenida inicial

- Nuevo paso `s0_welcome` al inicio de `ONBOARDING_STEPS` en `src/components/onboarding/steps.ts`, marcado con un flag `isWelcome: true`.
- A diferencia del resto, no apunta a un `targetId`: se renderiza como **modal centrado a pantalla completa** (no tooltip), con:
  - Título: "Te damos la bienvenida a Vittro"
  - Descripción breve y clara siguiendo el tono de marca: qué es Vittro, qué resuelve, y qué va a hacer este recorrido (~2-3 frases).
  - Botones: "Empezar recorrido" (avanza) y "Omitir por ahora" (skip).
- El `OnboardingTooltip` actual detecta `isWelcome` y, en ese caso, renderiza un componente nuevo `OnboardingWelcomeDialog` (basado en `Dialog` de shadcn) en vez del tooltip posicionado.
- El `OnboardingOverlay` no se muestra detrás del welcome (el Dialog ya tiene su propio backdrop).

### 3. Adaptación a mobile

Problema actual: en mobile la sidebar está colapsada (los `targetId` del sidebar como `mi-negocio-nav` y `sucursal-tab` no son visibles ni alcanzables) y los tooltips quedan fuera del viewport.

**Estrategia: bottom sheet en mobile, tooltip en desktop.**

- Detectar mobile con el hook existente `useIsMobile` dentro de `OnboardingTooltip`.
- En mobile, en lugar de tooltip flotante posicionado sobre el target:
  - Renderizar un **bottom sheet fijo** (basado en `Sheet` de shadcn con `side="bottom"`, sin modal/backdrop bloqueante) que ocupa el ancho completo y queda anclado abajo, con el contenido del paso (título, descripción, bullets, paso X de Y, botones Continuar / Omitir).
  - No depender del `targetRect` para posicionar; solo usarlo (cuando exista) para hacer scroll al elemento y resaltarlo si está visible.
  - El `OnboardingOverlay` en mobile se simplifica: si no hay `targetRect` visible o el spotlight no aplica (caso sidebar colapsada), no recorta nada — solo aplica un fondo semi-transparente suave detrás del sheet (o se omite).
- En desktop: comportamiento actual (tooltip + overlay con spotlight) se mantiene.

**Pasos que dependen del sidebar (`s1_sidebar`, `s4_select_sucursal`):**
- En mobile el sidebar de `Sheet` no está abierto. Dos opciones, elegimos la más simple:
  - Para `s1_sidebar`: el bottom sheet explica el módulo "Mi Negocio" sin requerir señalar el ítem del sidebar; al continuar, dispara directamente el cambio de tab (ya hace `tabSetterRef.current(currentStep.requiredTab)` en pasos siguientes — basta con que `s1_sidebar` también tenga `requiredTab: 'mi-negocio'` para que al avanzar el panel correcto esté activo).
  - Para `s4_select_sucursal`: en mobile la pestaña de sucursal sí es visible dentro del panel "Mi Negocio" (no es del sidebar), así que sigue funcionando. Verificar el `targetId="sucursal-tab"` y, si queda fuera del viewport, hacer `scrollIntoView` (ya existe esa lógica).
- No se cambia el contenido textual de los pasos.

### 4. Detalles técnicos

- Tipos: agregar `isWelcome?: boolean` a `OnboardingStep` y manejarlo en `OnboardingProvider` (no requiere `targetId` válido) y en `OnboardingTooltip`.
- `useIsMobile` ya existe en `src/hooks/use-mobile.tsx`.
- No se tocan migraciones ni RLS; `user_onboarding` queda igual.
- No se cambia la lógica de avance por evento ni la persistencia.

### Archivos a modificar

- `src/components/onboarding/steps.ts` — nuevo step welcome + tipo.
- `src/components/onboarding/OnboardingProvider.tsx` — gating por rol + soporte step welcome (no requiere targetRect).
- `src/components/onboarding/OnboardingTooltip.tsx` — branching: welcome dialog / mobile sheet / desktop tooltip.
- `src/components/onboarding/OnboardingOverlay.tsx` — no renderizar spotlight cuando es welcome o mobile sin target visible.
- `src/components/config/ConfigMenu.tsx` — botón "Ver tutorial otra vez" visible para owner y general manager.
- `src/hooks/useOnboardingState.ts` — exponer `isGeneralManager` (opcional; alternativamente leer `useAuth` directo en el provider).