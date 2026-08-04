# Etapa 2 — Llevar a 16px los campos que quedaron fuera del arreglo base

La Etapa 1 resolvió `Input`, `Textarea` y `SelectTrigger`. Quedan 18 campos que siguen haciendo zoom en iPhone porque tienen tamaño propio o no usan el componente compartido. Esta etapa los alinea, respetando el diseño compacto de cada pantalla.

## Correcciones al relevamiento previo

Antes del plan, tres precisiones que cambian el trabajo real:

- **`ComisionEquipoConfig.tsx` tiene 3 campos, no 8.** Los 8 eran líneas de código, no campos. Son: un `Input` de porcentaje `w-16 h-7`, un `SelectTrigger` `h-8` y otro `Input` de porcentaje `w-16 h-8`.
- **Los 2 inputs nativos de `PortalPublicoSection.tsx` (líneas 329 y 397) no hacen zoom.** El primero es `type="file"` y además está oculto (`className="hidden"`); el segundo es `type="color"`, que abre el selector nativo de color, no el teclado. **No se tocan.**
- **El campo `text-xs` de `PortalPublicoSection.tsx:253` sí hace zoom**: es la URL pública en `readOnly`. iOS igual hace foco y zoom en campos de solo lectura.

Total efectivo a tocar: **16 campos en 7 archivos**.

---

## 1. Login.tsx — recomendación: parchear el CSS, no migrar a `Input`

**Propuesta: cambiar `font-size: 14px` por `font-size: 16px` en `.input-field` (línea ~189), y agregar un media query que lo baje a 14px en desktop.**

Comparación de los dos caminos:

| | Migrar a `Input` base | Parchear el CSS propio |
|---|---|---|
| Prolijidad | Unifica Login con el sistema | Deja Login fuera del sistema |
| Superficie tocada | 6 campos + borrar ~17 líneas de CSS + revisar el `pr-10` de los dos campos con ojito | 1 línea + 3 de media query |
| Riesgo | Alto: Login usa colores hardcodeados (`#e2e8f0`, `#0f172a`, `#fff`) y un alto de 42px propio, distinto del `h-10` del sistema. Migrar cambia visualmente toda la pantalla de entrada, que es la primera impresión del producto | Nulo: solo cambia la letra |
| Deuda técnica | La salda | La mantiene |

**Recomiendo parchear.** El objetivo de esta etapa es el zoom, no rediseñar Login. Migrar Login al sistema de diseño es un trabajo legítimo, pero es un rediseño de la pantalla pública de entrada y merece su propia etapa con revisión visual dedicada — mezclarlo acá hace que un fix de accesibilidad pase por un cambio de imagen.

Concretamente, dentro del `<style>` de `Login.tsx`:

```text
.input-field { font-size: 16px; }              ← era 14px
@media (min-width: 768px) {
  .input-field { font-size: 14px; }            ← desktop igual que hoy
}
```

El alto de 42px del campo absorbe los 16px sin cambios. Los dos campos de contraseña tienen `pr-10` para el ícono del ojito, que está posicionado en absoluto y no se mueve.

## 2. Grupo 2 — overrides a `text-xs`, caso por caso

El patrón general es `text-base md:text-xs`: 16px en mobile, y en desktop queda **exactamente como hoy** (12px), o sea que la densidad compacta que se diseñó a propósito se conserva íntegra en la pantalla grande.

| Archivo | Campo | Hoy | Propuesta | Nota |
|---|---|---|---|---|
| `ComisionEquipoConfig.tsx:413` | % de comisión | `w-16 h-7 text-xs` | `w-16 h-7 md:h-7 h-9 text-base md:text-xs` → en mobile alto 36px | **Requiere subir el alto.** 16px en 28px de alto queda ahogado |
| `ComisionEquipoConfig.tsx:456` | Select de barbero | `h-8 text-xs` | `h-9 md:h-8 text-base md:text-xs` | Alto a 36px solo en mobile |
| `ComisionEquipoConfig.tsx:481` | % de comisión | `w-16 h-8 text-xs` | `w-16 h-9 md:h-8 text-base md:text-xs` | Ídem |
| `MpDevicesConfig.tsx:199` | Select de dispositivo | `w-full sm:w-[160px] h-9 text-xs` | `... h-10 md:h-9 text-base md:text-xs` | 36px aguanta 16px, pero 40px respira mejor |
| `BarberSucursalesGeneralSection.tsx:140` | Select de sucursal | `h-8 text-xs` | `h-9 md:h-8 text-base md:text-xs` | |
| `PortalPublicoSection.tsx:253` | URL pública (readOnly) | `font-mono text-xs` | `font-mono text-base md:text-xs` | **Riesgo alto, ver punto 4** |
| `NotificationsBell.tsx:421,433,444,457` | 4 filtros | `h-7 text-xs w-auto min-w-[...]` | `h-9 md:h-7 text-base md:text-xs` | **Riesgo alto, ver punto 4** |

Los `w-16` (64px) de los campos de porcentaje se mantienen: contienen como mucho un número de 5 caracteres (`100.0`), que entra en 16px.

## 3. Grupo 3 — inputs nativos

| Archivo | Campo | Hoy | Propuesta |
|---|---|---|---|
| `agenda/ClienteSearchPicker.tsx:58` | Buscador de clientes dentro del popover | `h-10 ... text-sm` | `text-base md:text-sm`. El alto de 40px ya está bien |
| `ui/phone-input.tsx:291` | Input de teléfono | `flex-1 ... text-sm` | `text-base md:text-sm`. **Además**, el botón de país al lado (línea ~224) también tiene `text-sm`: se le aplica el mismo cambio para que la bandera, el prefijo y el número queden del mismo tamaño y no se vea desparejo. Es un botón, no un campo, pero visualmente forman un solo control |
| `PortalPublicoSection.tsx:329,397` | file + color | — | **No se tocan**, no disparan zoom |

## 4. Dónde el riesgo es mayor que en la Etapa 1

Dos casos concretos, ambos por ancho, no por alto:

**a) Los 4 filtros de `NotificationsBell.tsx`.** Viven en una fila con `flex-wrap` dentro del panel desplegable de la campanita, con anchos mínimos de 90 a 110px y `h-7` (28px). Es el caso más delicado de los 16:
- Al pasar de 12px a 16px, valores como "Todas las sucursales" o "Últimos 30 días" van a truncarse antes. El `line-clamp-1` del `SelectTrigger` evita que rompa, pero el texto visible se acorta.
- Subir el alto de 28px a 36px en mobile engorda la fila de filtros y probablemente la haga saltar a dos líneas por el `flex-wrap`. Es un cambio visible en un panel que hoy es deliberadamente compacto.
- **Recomiendo hacerlos igual**, porque hoy tocar cualquiera de esos cuatro filtros en iPhone dispara zoom y desalinea el panel entero, que es peor que una fila más alta. Pero conviene mirarlos con captura antes de darlos por buenos.

**b) La URL pública de `PortalPublicoSection.tsx:253`.** Es `font-mono` y contiene una URL completa (`testingvitt.one/mi-barberia/reservar`). En mono a 16px, en una pantalla de 375px, se va a ver una porción bastante menor de la URL que hoy. Como es un campo de solo lectura cuyo propósito es copiarse con el botón de al lado (no leerse entero), el impacto real es bajo — pero es el campo donde más se nota el cambio.

Ningún caso tiene íconos superpuestos dentro del campo salvo los dos password de Login, que ya quedan cubiertos.

## 5. ¿Un build o varios?

**Recomiendo dos builds:**

- **Build A — Grupos 2 y 3** (6 archivos, 10 campos). Son cambios de clase Tailwind acotados, todos dentro de la app interna, todos con el mismo patrón. Bajo riesgo, se validan juntos.
- **Build B — Login.tsx** (1 archivo, 6 campos). Aislado por dos razones: es CSS plano en un `<style>` embebido en vez de clases Tailwind, y es la pantalla pública de entrada al producto. Si algo se ve raro, querés poder revertir Login sin tocar el resto.

Si preferís uno solo, es viable — pero validá Login por separado igual.

## Detalle técnico

Patrón único aplicado en toda la etapa: **la clase de mobile se agrega, la de desktop se preserva con prefijo `md:`**. Nada de reemplazar `text-xs` por `text-base` a secas — eso rompería la densidad compacta intencional en desktop.

Archivos a editar en Build A:
- `src/components/config/ComisionEquipoConfig.tsx` (3 campos, con ajuste de alto)
- `src/components/config/MpDevicesConfig.tsx` (1)
- `src/components/config/BarberSucursalesGeneralSection.tsx` (1)
- `src/components/config/PortalPublicoSection.tsx` (1, línea 253)
- `src/components/notifications/NotificationsBell.tsx` (4, con ajuste de alto)
- `src/components/agenda/ClienteSearchPicker.tsx` (1)
- `src/components/ui/phone-input.tsx` (1 input + 1 botón de país)

Archivo a editar en Build B:
- `src/pages/Login.tsx` (bloque `<style>`, regla `.input-field`)

No se tocan: `input.tsx`, `textarea.tsx`, `select.tsx`, `SelectItem`, ni ningún campo fuera de esta lista. Sin cambios de lógica, validación ni datos.

## Validación después del build

En preview mobile (393px):

1. Comisiones por equipo: tocar un campo de porcentaje — sin zoom, y la fila no debe quedar apretada.
2. Campanita de notificaciones: abrir el panel, tocar cada filtro — sin zoom; verificar cuánto texto queda visible y si la fila salta de línea.
3. Portal público: verificar cuánta URL se ve en el campo de solo lectura.
4. Cobrar / agenda: abrir el buscador de clientes y escribir — sin zoom.
5. Cualquier formulario con teléfono: verificar que bandera, prefijo y número queden alineados y del mismo tamaño.
6. Login (Build B): tocar email y contraseña — sin zoom; el ojito debe seguir centrado.
7. Desktop: confirmar que ninguna de estas pantallas cambió de aspecto.
