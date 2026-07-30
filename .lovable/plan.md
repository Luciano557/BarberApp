# Reestructuración del onboarding guiado

Reordenar y sanear los pasos del tour para que apunten a la UI actual de "Mi Negocio", eliminar los dos pasos que hoy apuntan a un target que no existe en el DOM y destrabar el paso de selección de sucursal.

## Orden final de pasos

| # | id propuesto | Target | Cambio |
|---|---|---|---|
| 0 | `s0_welcome` | — | Sin cambios |
| 1 | `s1_sidebar` | `mi-negocio-nav` | Sin cambios |
| 2 | `s2b_general_tab` | `general-tab` | Sin cambios (pasa a posición 2) |
| 3 | `s3_equipo_general` | nuevo `equipo-general-section` | Reemplaza `s6_equipo` |
| 4 | `s4_cuenta_sucursal` | `cuentas-sucursal-section` | Fusión de `s2_cuenta_intro` + `s3_cuenta_bullets`, con apertura forzada del collapsible |
| 5 | `s5_select_sucursal` | `sucursal-tab` | Mantiene avance por evento + auto-detección |
| 6 | `s6_info` | `info-sucursal-card` + `cuenta-sucursal-button` | Amplía el texto y agrega segundo spotlight |
| 7 | `s7_catalogo` | `catalogo-section` | Sin cambios |
| 8 | `s8_pagos` | `metodos-pago-section` | Sin cambios |

Se elimina `hideOnMobile` del paso de cuenta de sucursal (hoy en `s2_cuenta_intro`): al abrirse el collapsible el contenido existe también en mobile.

## Archivos a modificar

**`src/components/onboarding/steps.ts`**
- Reordenar el array `ONBOARDING_STEPS` según la tabla.
- Fusionar los dos pasos de cuenta de sucursal en uno solo, con `bullets` en vez de dos pantallas.
- Nuevas propiedades opcionales en la interfaz `OnboardingStep`:
  - `requiresOpen?: string` — id de una sección colapsable que el motor debe pedir abrir antes de mostrar el paso.
  - `secondaryTargetId?: string` — segundo elemento a resaltar (botón "Cuenta de sucursal" en el paso 6).
  - `autoAdvanceIf?: 'on-sucursal-tab'` — condición de auto-avance del paso 5.
  - `optionalTarget?: boolean` — para el comportamiento de fallback del punto de validación general.
- Cambiar el target del paso de equipo a `equipo-general-section`.

**`src/components/onboarding/OnboardingProvider.tsx`**
- Registro de "abridores de sección": `registerSectionOpener(id, fn)` / `requestOpen(id)`, mismo patrón que `registerTabSetter` / `registerSubTabSetter`. Antes de calcular el rect del paso, si `requiresOpen` está definido, se invoca el opener registrado y se espera a que el target aparezca.
- Auto-avance del paso 5 (detalle abajo).
- Tracking del `secondaryTargetId` (segundo rect) para el paso 6.
- Ajuste de `isAllowedTab` si algún id hardcodeado (`'s1_sidebar'`) cambia de nombre — se mantienen los ids `s0_welcome`, `s1_sidebar`, `s2b_general_tab` para minimizar rupturas.

**`src/components/onboarding/OnboardingOverlay.tsx`**
- Soportar dos recortes de spotlight cuando hay `secondaryTargetId` (o un rect unión de ambos, decisión visual al implementar).
- Renderizar los `bullets` del paso fusionado.

**`src/components/MiNegocioGeneralTabContent.tsx`**
- Registrar el opener de la sección "Cuentas de sucursal" contra el provider, de modo que `setCuentasOpen(true)` pueda dispararse desde el onboarding.
- Agregar `data-onboarding-id="equipo-general-section"` al bloque `#seccion-equipo` (hoy solo tiene `id`).

**`src/components/MiNegocioPanel.tsx`**
- Exponer al provider cuál es la sub-tab activa (o un helper `isOnSucursalTab()`), necesario para la auto-detección del paso 5.
- Revisar la interacción entre `miNegocioSubTab: 'general'` del paso 5 y la auto-detección (ver riesgos).

**`src/components/SucursalTabContent.tsx`**
- Sin cambios funcionales. El `data-onboarding-id="cuenta-sucursal-button"` ya existe (línea 269) y se reutiliza como target secundario.
- El `data-onboarding-id="equipo-section"` de la línea 323 deja de ser target del tour; se puede conservar sin efecto.

## Fix del paso 5 — auto-detección de sucursal activa

Hoy el paso solo avanza con `notifyEvent('mi-negocio:sucursal-selected')`, que se emite desde `handleTabChange` en `MiNegocioPanel.tsx:241`. Radix no llama `onValueChange` cuando el valor no cambia, así que si el usuario ya está parado en la pestaña de la sucursal, el clic no emite nada y el paso queda trabado.

Mecanismo propuesto: `MiNegocioPanel` registra en el provider una función de consulta (`registerSubTabProbe`) que devuelve si el tab activo corresponde a una sucursal válida. Al montarse un paso con `autoAdvanceIf: 'on-sucursal-tab'`, el provider consulta el probe tras un tick corto (para dejar que el efecto de `miNegocioSubTab` se aplique) y, si el resultado es afirmativo, llama `next()` en lugar de esperar el evento. Si no, mantiene exactamente el comportamiento actual.

Salvaguarda: el auto-avance debe ejecutarse una sola vez por montaje del paso (ref de guardia) para evitar avanzar en cadena si el probe cambia por re-render.

## Apertura forzada del collapsible (paso 4)

`MiNegocioGeneralTabContent` ya controla el estado con `cuentasOpen` (línea 78). Se registra ese setter en el provider mediante `registerSectionOpener('cuentas-sucursal', () => setCuentasOpen(true))` dentro de un `useEffect`, con cleanup al desmontar. El provider, al entrar al paso con `requiresOpen: 'cuentas-sucursal'`, invoca el opener y recién después busca el target; el loop de `requestAnimationFrame` que ya calcula el rect absorbe el retardo de animación del `CollapsibleContent`, así que no hace falta esperar explícitamente.

Nota: el target del paso es `cuentas-sucursal-section` (la `Card` de `CuentasSucursalConfig`), que existe apenas se abre el collapsible externo. No hace falta abrir además el collapsible interno "Configuración avanzada" — ese es config de PIN y no forma parte del mensaje del paso.

## Punto de decisión — progreso ya guardado en `user_onboarding`

Los ids cambian (fusión de dos en uno y reordenamiento), así que `completed_steps` y `current_step` de usuarios con progreso quedan desalineados. Comportamiento actual del motor: `steps.findIndex(s => s.id === resumeId)` y, si no encuentra el id, reanuda desde el paso 0. Es decir, sin hacer nada, los usuarios trabados en `s2_cuenta_intro` o `s3_cuenta_bullets` vuelven a empezar el tour completo, y `completed_steps` queda con ids muertos (dato histórico inofensivo, pero ruidoso para métricas).

Opciones:

- **A (recomendada, sin migración):** mapa de alias en `steps.ts` (`s2_cuenta_intro` y `s3_cuenta_bullets` → `s4_cuenta_sucursal`; `s6_equipo` → `s3_equipo_general`) que el provider aplica al resolver `resumeId`. Los usuarios reanudan en el paso equivalente y no se pierde progreso. `completed_steps` histórico se deja como está.
- **B:** migración SQL que reescribe `current_step` y `completed_steps` de las filas existentes. Deja la tabla limpia para métricas, pero es un cambio destructivo sobre datos históricos.
- **C:** reset — poner en `pending` a quienes están `in_progress`. El tour vuelve a correr entero; simple pero molesto para quien ya lo hizo a medias.

Antes de implementar hace falta elegir entre A, B y C. Los `completed` y `skipped` no se tocan en ninguna opción.

## Validación general de targets (preventivo)

Propuesta para el motor: al entrar a un paso, si tras un plazo acotado (por ejemplo ~1,5 s de reintentos con el rAF que ya existe) el target no aparece en el DOM:

1. Si el paso tiene `optionalTarget: true` → saltarlo silenciosamente y avanzar.
2. Si no → mostrar el tooltip en modo centrado (mismo layout que el paso de bienvenida) con el botón "Continuar" visible, en vez de quedar con `targetRect = null` y sin salida.
3. En ambos casos, registrar el fallo en consola con el id del paso, para diagnóstico.

Esto evita que un futuro cambio de UI vuelva a producir el bug de abandono. Es un cambio de comportamiento del motor y conviene implementarlo en un commit separado del reorden de pasos.

## Riesgos y dependencias

- **`miNegocioSubTab: 'general'` vs. auto-detección:** el paso 5 hoy declara sub-tab `general`, y el efecto del provider fuerza `handleTabChange(GENERAL_TAB)` al entrar. Con eso, el usuario nunca "ya está" en una sucursal cuando el paso se muestra. Hay que resolver el orden: consultar el probe **antes** de aplicar el `miNegocioSubTab`, o quitar el `miNegocioSubTab` de ese paso. Sin esto, el fix no tiene efecto.
- **Efecto colateral del `subTabSetter`:** `handleTabChange` emite `notifyEvent('mi-negocio:sucursal-selected')` cuando el valor no es `GENERAL_TAB`. Si el motor fuerza la sub-tab a `first-sucursal` mientras el paso 5 sigue activo, avanzaría solo por vía indirecta. Verificar que el auto-avance y el evento no se pisen.
- **Paso 3 (equipo en General):** `EquipoGeneralConfig` solo se monta si `canManageEquipo`. Para un GM sin ese permiso el target no existiría — caso de uso del `optionalTarget` de la sección anterior.
- **Métricas:** cualquier análisis existente sobre `user_onboarding` que asuma los ids viejos deja de ser comparable. Documentar la fecha de corte.
- **Mobile:** al quitar `hideOnMobile` del paso de cuenta de sucursal, hay que verificar el layout del spotlight sobre el collapsible abierto en pantallas chicas.
- **Doble spotlight del paso 6:** `info-sucursal-card` y `cuenta-sucursal-button` están anidados (el botón vive dentro del `CardHeader` de la card), así que resaltar la card ya lo incluye visualmente. Puede alcanzar con mencionarlo en el texto y evitar la complejidad del segundo rect — decisión a tomar al implementar.
