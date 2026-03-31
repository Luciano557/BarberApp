

## Problema

Samsung Internet ignora `inputMode="numeric"` en ciertos contextos y detecta el `<form>` como formulario de login, sugiriendo autocompletado de email. Esto pasa porque:
1. Algunos navegadores necesitan `pattern="[0-9]*"` además de `inputMode` para forzar teclado numérico
2. El navegador detecta un formulario con un campo de texto + botón submit como login form

## Plan

### Archivos a modificar: `PinGateDialog.tsx` y `StaffPinDialog.tsx`

**Cambios en cada input de PIN:**

1. Agregar `pattern="[0-9]*"` — esto fuerza teclado numérico en Safari iOS y Samsung Internet
2. Agregar `name` con valor no-estándar (ej: `name="app-pin-code"`) — evita que el browser lo asocie a campos de login
3. Agregar `autoComplete="one-time-code"` en vez de `"off"` — los browsers respetan más este valor y no ofrecen guardar credenciales
4. Envolver el `<form>` con `autoComplete="off"` a nivel form también

**Resumen de atributos finales por input:**
```
type="text"
inputMode="numeric"
pattern="[0-9]*"
name="app-pin-code"
autoComplete="one-time-code"
data-1p-ignore
data-lpignore="true"
data-form-type="other"
```

