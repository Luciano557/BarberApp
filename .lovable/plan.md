## Objetivo

Que el `PhoneInput` sea realmente universal y multi-país en Equipo, Clientes, Nueva cita y Sucursales, con selector de país funcional y validación E.164 por país.

## Diagnóstico

Causa raíz única detrás de los tres bugs reportados:

- Todos los consumidores actuales pasan `allowedCountries={['AR']}`.
- En `phone-input.tsx`, eso activa la rama `singleCountry = allowedCountries.length <= 1`, que renderiza el chip de país como botón deshabilitado (sin ChevronDown, sin Popover).
- Resultado: en Clientes, Equipo y Sucursales el selector está visualmente presente pero no se puede abrir. En Sucursales además visualmente parece "input viejo" porque el chip aparece sin el indicador desplegable.

Sucursales ya usa `PhoneInput` (en `SucursalesConfig.tsx` línea 365 y `MiNegocioPanel.tsx` línea 471) — no quedó input libre. El problema es el mismo: `allowedCountries={['AR']}` lo bloquea.

`src/lib/phone.ts` ya soporta multi-país vía `libphonenumber-js` cuando `defaultCountry !== 'AR'`. No requiere cambios estructurales, solo asegurar que `canonicalizePhone` con país no-AR no aplique reglas AR.

## Cambios

### 1. `src/components/ui/phone-input.tsx`

- Cambiar el default de `allowedCountries` a `['AR', 'UY', 'CL', 'CO', 'MX', 'ES', 'BR']`.
- Eliminar el "lock" visual cuando hay un solo país permitido: el chip siempre muestra bandera + nombre/dial + ChevronDown, pero el Popover solo se abre si `allowedCountries.length > 1`. Si es 1, el chip queda informativo (no clickeable, sin chevron).
- Asegurar que al cambiar de país desde el Popover se re-emita el valor canonicalizado con el nuevo `defaultCountry` (ya está vía `handleCountryChange` → `emit(raw, next)`; verificar que `formatPhoneDisplay` y `stripDialPrefix` toleren países no-AR usando `pn.formatInternational()` y el `dial` del `COUNTRY_META`).
- En `handleBlur`, para países no-AR re-hidratar `raw` desde el número nacional formateado por `libphonenumber-js` (no aplicar reglas AR).
- Ajustar el helper text inferior para que muestre el placeholder del país activo (ya lo hace) y no mencione "móvil o fijo" en países donde `mode='any'` no aplica reglas AR.

### 2. Consumidores — quitar `allowedCountries={['AR']}`

Reemplazar en estos archivos por la lista multi-país (o dejar el default del componente):

- `src/components/clientes/NuevoClienteDialog.tsx` (línea ~143)
- `src/components/clientes/ClienteDetailDialog.tsx` (línea ~382)
- `src/components/agenda/NewAppointmentDialog.tsx` (línea ~394)
- `src/components/config/EquipoUnificado.tsx` (línea ~1215)
- `src/components/config/StaffConfig.tsx` (línea ~107)
- `src/components/config/SucursalesConfig.tsx` (línea ~365) — `mode="any"`
- `src/components/MiNegocioPanel.tsx` (línea ~471) — `mode="any"` para sucursal

Uso final estándar:

```tsx
<PhoneInput
  mode="mobile"  // "any" sólo en Sucursales/MiNegocio sucursal
  defaultCountry="AR"
  allowedCountries={['AR', 'UY', 'CL', 'CO', 'MX', 'ES', 'BR']}
  value={...}
  onChange={...}
/>
```

### 3. Persistencia / defensa final

- En cada `handleSave`, seguir guardando `phoneOut.e164` cuando `phoneOut.isValid`. Si el país elegido no es AR, ya viene en E.164 internacional desde `canonicalizePhone`.
- En `useSupabaseData.ts` (`safeBarberPhone`) y wrappers de clientes/sucursales: aceptar cualquier E.164 válido (no solo `+549...`). Si el valor empieza con `+` y tiene 8–15 dígitos, se persiste como vino del componente; sólo se rechaza texto crudo o E.164 inválido según `parsePhoneNumberFromString`.

### 4. Display

- `formatPhoneDisplay` ya cubre AR móvil, AR fijo y otros países (usa `pn.formatInternational()`). No requiere cambios.
- Verificar listados de barberos, clientes y sucursales: usan `formatPhoneDisplay`, por lo que números MX/ES/etc. se mostrarán con formato internacional automáticamente.

## Fuera de alcance

- Edge functions y `supabase/functions/_shared/phone.ts` (siguen sin tocarse en esta fase).
- Migraciones de datos legacy.
- Auth/OTP, WhatsApp real, portal público, importaciones.

## QA manual

Por cada formulario (Nuevo cliente, Editar cliente, Nueva cita > nuevo cliente, Nuevo barbero, Editar barbero, Nueva sucursal, Editar sucursal y Mi Negocio sucursal):

1. Abrir selector → debe listar AR, UY, CL, CO, MX, ES, BR con buscador.
2. Elegir UY, tipear `99 123 456` → guarda `+59899123456`, muestra `+598 99 123 456`.
3. Elegir MX, tipear `55 1234 5678` → guarda `+525512345678`.
4. Elegir AR, tipear `11 2516 2528` (mode `mobile`) → guarda `+5491125162528`.
5. Elegir AR en Sucursal (mode `any`), tipear `11 4555 1234` → guarda `+541145551234` (fijo, sin 9).
6. Pegar `+34 612 34 56 78` → auto-detecta ES y guarda `+34612345678`.
7. Pegar `*ABC*` → no persiste, muestra error.
8. Dejar vacío en campo opcional → guarda NULL sin error.

## Entrega

- Archivos modificados: `phone-input.tsx`, 7 consumidores listados, `useSupabaseData.ts` (defensa final).
- Confirmación: selector visible y funcional en los 4 flujos, sin inputs libres.
- DB guarda E.164 por país; AR móvil `+549...`, AR fijo `+54...` solo en Sucursales.
