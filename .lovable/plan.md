

## Plan: Selector de plan en registro

Agregar un selector de plan en el formulario de registro de `src/pages/Login.tsx` (solo visible en modo `register`).

### Cambios

**`src/pages/Login.tsx`**

1. Nuevo estado: `const [plan, setPlan] = useState<'basico' | 'profesional' | 'premium'>('basico');`

2. Nuevo campo en el formulario de registro, ubicado **debajo del selector de País** y **arriba de "Nombre de tu barbería"**:

```text
┌─────────────────────────────────────────────────┐
│ ⌘ Plan                                          │
│ ┌─────────────────────────────────────────────┐ │
│ │ Básico  [Gratis]  $30.000 después del 1er… ▾│ │
│ └─────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────┘
```

3. Estructura del `<SelectItem>` para cada plan:
   - Nombre del plan (`Básico` / `Profesional` / `Premium`)
   - Badge `Gratis` con `background: rgb(30, 42, 74)` y texto blanco, `border-radius: 4px`, `padding: 2px 6px`, `font-size: 11px`
   - Texto a la derecha: `"$30.000 después del primer mes"` con `color: #94a3b8` (gris) y `text-decoration: line-through` aplicado solo al precio

4. Datos:
   ```ts
   const PLANS = [
     { id: 'basico',       label: 'Básico',       price: '$30.000'  },
     { id: 'profesional',  label: 'Profesional',  price: '$50.000'  },
     { id: 'premium',      label: 'Premium',      price: '$100.000' },
   ];
   ```

5. **Persistencia**: por ahora el plan seleccionado se mantiene en estado local. La función `signUp` actual no recibe `plan` — se deja un `// TODO` para integrar la persistencia del plan elegido (requeriría tocar `AuthContext.signUp` y la lógica de creación de organización). Esta entrega cubre solo la UI del selector como pidió el usuario.

### Detalles visuales

- Reusar `Select`, `SelectTrigger`, `SelectContent`, `SelectItem`, `SelectValue` ya importados.
- Trigger: misma altura/estilo que el selector de País (`h-[42px] rounded-[10px] border-slate-200`).
- Mostrar dentro del trigger: `Nombre · [Gratis] · $precio tachado después del primer mes`.
- En cada item del dropdown: layout `flex items-center gap-2` con el badge azul oscuro y el precio tachado en gris a la derecha.

### Archivos a modificar

| Archivo | Acción |
|---|---|
| `src/pages/Login.tsx` | Agregar estado `plan` y nuevo `<Select>` de planes en el formulario de registro |

