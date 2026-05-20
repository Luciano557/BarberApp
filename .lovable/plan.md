# Plan (v2 — ajustes aprobados): PhoneInput multi-país + UX en Equipo / Barberos

Cambios respecto del plan anterior:
1. `PhoneInput` usa `type="tel"` + `inputMode="tel"` (no `numeric`), para que el usuario pueda pegar formatos con `+`, espacios, guiones o paréntesis. La sanitización limpia antes de persistir.
2. `libphonenumber-js` se integra **solo en frontend**, dentro de `src/lib/phone.ts`. **No se toca** `supabase/functions/_shared/phone.ts` ni edge functions en esta fase.
3. `formatPhoneDisplay` tolerante: `null`/`''` → `''`; E.164 válido → formateado; valor inválido/legacy → devuelve el string original sin romper la UI.

## 1. Librería

- `bun add libphonenumber-js` (variante `min`, ~26KB gzip).
- Único importador: `src/lib/phone.ts`. Componentes/hooks consumen siempre el wrapper.
- Edge functions y `supabase/functions/_shared/phone.ts` quedan **intactas** (alcance: Equipo / Barberos). Si más adelante abrimos multi-país en portal/clientes, se evalúa llevar la librería también allá.

## 2. Wrapper `src/lib/phone.ts` (extendido)

Conserva la API actual (`canonicalizePhoneAR`, `formatPhoneDisplay`, `buildWhatsAppNumber`, `buildWhatsAppLink`, `isValidPhoneAR`, `phoneErrorMessage`) y agrega:

```ts
export type CountryCode = 'AR' | 'MX' | 'ES' | 'BR' | 'UY' | 'CL' | 'CO';
export function canonicalizePhone(input, opts?: { defaultCountry?: CountryCode }): CanonicalizeResult;
export function parsePhone(input, country?: CountryCode): { country, areaCode, subscriber, e164 } | null;
export function isValidPhone(input, country?: CountryCode): boolean;
```

### Estrategia AR (clave del bug del `9`)

`canonicalizePhoneAR` se mantiene como **pre-procesador legacy** y resuelve los formatos AR conocidos primero (`1169599710`, `11 6959-9710`, `011 15 6959-9710`, `+54 11 6959-9710`, `+54 9 11 6959-9710`) → todos a `+5491169599710`. Si la heurística no matchea, hace **fallback a `parsePhoneNumberFromString(raw, 'AR')`** y, si la librería devuelve un E.164 sin el `9` móvil, el wrapper se lo agrega. Se preservan los reasons `foreign` y `ambiguous_landline` (`011...` sin `15`).

### `formatPhoneDisplay` tolerante

- `null` / `undefined` / `''` → `''`.
- AR canónico → `+54 9 11 6959-9710` (render manual coherente).
- E.164 de otro país → `pn.formatInternational()` vía libphonenumber-js.
- Inválido/legacy → devuelve el string original tal cual (no rompe la UI).

## 3. Componente `src/components/ui/phone-input.tsx` (nuevo)

```ts
interface PhoneInputProps {
  value: string | null;
  onChange: (out: {
    e164: string | null;
    isValid: boolean;
    country: CountryCode | null;
    display: string;
    reason?: 'empty' | 'invalid' | 'foreign' | 'ambiguous_landline';
  }) => void;
  defaultCountry?: CountryCode;     // 'AR'
  allowedCountries?: CountryCode[]; // ['AR']
  required?: boolean;
  disabled?: boolean;
  id?: string; name?: string; className?: string;
}
```

### Layout

```text
┌──────────────────┬──────────────────────────┐
│ +54  (▾ si >1)   │ 11 2516-2528             │
└──────────────────┴──────────────────────────┘
```

- Selector de país: `Popover` + `Command`. Si `allowedCountries.length === 1`, se muestra solo el dial code sin trigger (caso actual: AR).
- Input derecho: **`type="tel"`, `inputMode="tel"`**, `autoComplete="tel"`. Permite pegar `+`, espacios, guiones, paréntesis.
- Sanitización on-change: `replace(/[^\d\s\-()+]/g, '')` → caracteres inválidos (letras, `*`) se eliminan antes de tocar el estado. Pegar `1125162528*` deja `1125162528` y emite `+5491125162528`.
- Reformat suave on-blur si el valor es válido.
- Hidratación desde `value` (E.164): muestra la parte nacional editable, sin el `+54 9 ` para AR.
- **Sin toggle `9`.** El `9` aparece únicamente en el display formateado.

### Estados de error inline

- vacío + no required → válido.
- vacío + required → "Ingresá un teléfono."
- inválido → "Revisá el teléfono. Ingresá código de área y número sin prefijos extra."
- ambiguous_landline → "Parece un fijo. Ingresá un móvil con código de área y sin el 0 ni el 15."
- foreign → "Por ahora solo aceptamos teléfonos argentinos."

Error visible solo después de `touched` (blur). Texto helper sutil: "Ej: 11 2516-2528".

### Estilo

Tokens semánticos (`border`, `muted`, `foreground`, `destructive`, `ring`). Altura `h-10` igual al `Input` shadcn, separador interno `border-r`. Sin emojis.

## 4. Aplicación en Equipo / Barberos

### `src/components/config/EquipoUnificado.tsx`
- Línea ~1207: reemplazar `<Input placeholder="Teléfono *" ...>` por `<PhoneInput value={localData.phone || null} onChange={(o) => { setLocalData(p => ({ ...p, phone: o.e164 ?? '' })); setPhoneOut(o); }} defaultCountry="AR" allowedCountries={['AR']} />`.
- Teléfono pasa a **opcional**: quitar `*`, quitar `!localData.phone` de la guard `handleSubmit` (línea 1186) y del `disabled` (línea 1329). Bloquear submit solo si `phoneOut && !phoneOut.isValid && phoneOut.reason !== 'empty'`.
- Línea 778: `{barber.phone}` → `{formatPhoneDisplay(barber.phone)}`; ocultar el bloque si vacío.

### `src/components/config/StaffConfig.tsx`
- Línea 102: mismo reemplazo por `<PhoneInput>`.
- Línea 118: quitar `!localData.phone` del `disabled`.
- Línea 161: `📞 {barber.phone}` → `{formatPhoneDisplay(barber.phone)}`; ocultar si vacío.

### `src/components/MiNegocioPanel.tsx`
- **Sin cambios visuales aquí.** Solo edita `sucursales.telefono` (línea 456) — fuera de scope. Las escrituras a `barberos.telefono` (líneas 243, 262) pasan por `addBarber`/`updateBarber`, que se defienden en `useSupabaseData`.

### `src/hooks/useSupabaseData.ts` (defensa final)

Agregar helper local y aplicarlo en `addBarber` (línea ~662) y `updateBarber` (línea ~695):

```ts
import { canonicalizePhoneAR, phoneErrorMessage } from '@/lib/phone';

function safeBarberPhone(input: unknown): string | null {
  const raw = (input ?? '').toString().trim();
  if (!raw) return null;
  const r = canonicalizePhoneAR(raw);
  if (!r.ok) throw new Error(phoneErrorMessage(r.reason));
  return r.e164;
}
```

- `addBarber`: `telefono: safeBarberPhone(barber.phone)`.
- `updateBarber`: `if (updates.phone !== undefined) dbUpdates.telefono = safeBarberPhone(updates.phone);`.
- El `throw` cae en el `catch` existente: `toast.error(err.message)` con mensaje legible.

### `src/types/barbershop.ts`
- Comentario en `Barber.phone`: `// E.164 canónico (ej: '+5491125162528') o '' / null`. Sin cambios estructurales.

## 5. Persistencia

`barberos.telefono` recibe siempre `NULL` o `+549XXXXXXXXXX`. Dos capas: `PhoneInput` (UI) + `safeBarberPhone` (último filtro). Nunca espacios, guiones, paréntesis, `*` ni texto crudo.

## 6. Países habilitados ahora

Solo AR (`allowedCountries={['AR']}`). Componente listo para abrir `MX | ES | BR | UY | CL | CO` cambiando la prop, sin tocar lógica.

## 7. Pruebas manuales

| # | Input | DB | UI | Resultado |
|---|---|---|---|---|
| 1 | `11 2516-2528` | `+5491125162528` | `+54 9 11 2516-2528` | válido |
| 2 | pegar `+5491125162528` | `+5491125162528` | `+54 9 11 2516-2528` | válido |
| 3 | `011 15 2516-2528` | `+5491125162528` | `+54 9 11 2516-2528` | válido |
| 4 | `1125162528*` | `+5491125162528` | `+54 9 11 2516-2528` | `*` filtrado en input |
| 5 | `98` | — | error inline | submit bloqueado |
| 6 | `011 2516-2528` | — | "parece fijo" | submit bloqueado |
| 7 | vacío | `NULL` | (oculto) | guarda OK |

Verificación: `select telefono from barberos` → solo E.164 o `NULL`.

## 8. Fuera de scope

`sucursales.telefono`, `organizations`, abrir MX/ES/BR/UY/CL/CO, migrar clientes/agenda/portal/importaciones al componente visual, llevar `libphonenumber-js` a edge functions.

## 9. Archivos

- **Nuevos:** `src/components/ui/phone-input.tsx`.
- **Modificados:** `src/lib/phone.ts`, `src/components/config/EquipoUnificado.tsx`, `src/components/config/StaffConfig.tsx`, `src/hooks/useSupabaseData.ts`, comentario en `src/types/barbershop.ts`.
- **Dependencia:** `libphonenumber-js@^1.x`.
- **Sin cambios:** `supabase/functions/_shared/phone.ts`, edge functions, `MiNegocioPanel.tsx`.
