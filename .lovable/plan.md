

## Resumen

Solucionar dos problemas con los inputs de PIN: (1) que muestre teclado numérico en lugar de alfanumérico, y (2) que Chrome/gestores de contraseñas no ofrezcan guardar el PIN.

## Causa raíz

- `type="password"` es lo que hace que Chrome detecte el campo como contraseña y ofrezca guardarlo. También en algunos navegadores móviles, `type="password"` anula `inputMode="numeric"` y muestra teclado alfanumérico.

## Plan

### 1. Cambiar todos los inputs de PIN a `type="text"` con enmascaramiento visual por CSS

En lugar de `type="password"`, usar `type="text"` con la propiedad CSS `-webkit-text-security: disc` para mostrar puntos. Esto:
- Evita que Chrome lo detecte como campo de contraseña
- Permite que `inputMode="numeric"` funcione correctamente y muestre teclado numérico
- Visualmente sigue mostrando puntos como un campo de contraseña

### 2. Agregar atributos anti-autocompletado

En cada input de PIN, agregar:
- `autoComplete="off"`
- `data-1p-ignore` (1Password)
- `data-lpignore="true"` (LastPass)
- `data-form-type="other"` (genérico)

### 3. Archivos a modificar

- **`PinGateDialog.tsx`** — input principal de PIN de acceso
- **`StaffPinDialog.tsx`** — 3 inputs: PIN actual, nuevo PIN, confirmar PIN

### 4. Toggle de visibilidad

Cuando el usuario activa "mostrar PIN", se remueve el estilo `-webkit-text-security` para mostrar los dígitos en texto plano. El toggle sigue funcionando igual que ahora.

---

## Detalle técnico

```text
Antes:  type="password" inputMode="numeric"  → Chrome: "¿Guardar contraseña?" + teclado alfanumérico
Después: type="text" inputMode="numeric" style="-webkit-text-security: disc" autocomplete="off"
         → Sin prompt de contraseña + teclado numérico
```

Se aplica el estilo inline condicionalmente: `style={{ WebkitTextSecurity: showPin ? 'none' : 'disc' }}`

