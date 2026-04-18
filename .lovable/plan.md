

## Plan: Homepage en `/` + app interna en `/app/:orgSlug`

### Routing

```text
/                      → Homepage pública (NUEVO)
/login                 → Login
/reset-password        → ResetPassword
/:orgSlug/reservar     → Reservar (sin cambios)
/app/:orgSlug          → Index (app interna, protegida)
```

Tras login exitoso, redirigir a `/app/{orgSlug}` usando el slug de la organización del usuario (disponible vía `OrganizationContext`).

### Cambios por archivo

**`src/App.tsx`**
- Agregar `<Route path="/" element={<Homepage />} />`
- Cambiar la ruta protegida de `/` a `/app/:orgSlug`

**`src/pages/Login.tsx`**
- Tras login: leer slug de la org del usuario y redirigir a `/app/{slug}` (en vez de `/`)
- Soportar `?mode=signup` (querystring) para abrir directo en la pestaña de registro

**`src/components/ProtectedRoute.tsx`**
- Validar que `:orgSlug` de la URL coincide con la org del usuario logueado; si no, redirigir al slug correcto

**`src/pages/Homepage.tsx`** (NUEVO) — landing pública mobile-first:
1. **Header sticky**: Logo "Vittro" + botón "Iniciar sesión"
2. **Hero**: 
   - H1 "Sabé exactamente cuánto gana tu barbería"
   - Subtítulo de beneficio (turnos + ingresos + rendimiento en un lugar)
   - Pills con preguntas: "¿Cuánto ganaste realmente esta semana?" · "¿Qué barbero te genera más ingresos?" · "¿Cuál es tu servicio más rentable?"
   - CTAs: "Registrar mi barbería" → `/login?mode=signup` · "Iniciar sesión" → `/login`
3. **Problema → Solución**: 3 dolores (turnos desordenados / números a ojo / sin control del equipo) + bloque de solución
4. **Funcionalidades** (4 cards, iconos lucide):
   - Gestión de turnos (Calendar)
   - Control de finanzas (TrendingUp)
   - Gestión de barberos (Users)
   - Trazabilidad y estadísticas (BarChart3)
5. **Valor diferencial**: 3 puntos — "No es solo una agenda" / "Entendé tu negocio" / "Decidí con datos reales"
6. **Registra tu barbería**: 3 cards de planes (Free / Basic / Premium, alineado con `mem://features/config/plans-and-corrections`) con CTA "Registrar mi barbería"
7. **CTA final**: "Empezá a tener control real de tu barbería hoy" + "Crear cuenta"
8. **Footer minimal**: Logo + © Vittro

**`src/index.css`**
- Actualizar variables de color al nuevo azul/índigo de Vittro (modo light), conversión hex→HSL:
```text
--color-50:  231 80% 95%
--color-100: 232 78% 86%
--color-200: 232 76% 77%
--color-300: 232 74% 68%
--color-400: 232 75% 59%
--color-500: 232 74% 50%
--color-600: 232 74% 41%
--color-700: 232 74% 32%
--color-800: 232 74% 19%
--color-900: 232 75% 14%
--color-950: 232 79% 5%
```
- Esto actualiza `--primary`, `--ring`, etc. derivadas. Modo dark intacto.

### Archivos a crear/modificar

| Archivo | Acción |
|---|---|
| `src/pages/Homepage.tsx` | Nuevo — landing pública |
| `src/App.tsx` | Ruta `/` para Homepage; mover Index a `/app/:orgSlug` |
| `src/pages/Login.tsx` | Redirect post-login a `/app/{slug}`; soportar `?mode=signup` |
| `src/components/ProtectedRoute.tsx` | Validar `:orgSlug` vs org del usuario |
| `src/index.css` | Nueva paleta azul/índigo de Vittro |

### Notas
- Sin cambios en DB, edge functions, ni en la lógica interna de la app
- Componentes UI existentes: `Button`, `Card`, `Badge`
- Iconos: `Scissors`, `Calendar`, `TrendingUp`, `Users`, `BarChart3`, `Check`, `ArrowRight`
- Copy en español rioplatense (vos), tono directo, sin marketing genérico

