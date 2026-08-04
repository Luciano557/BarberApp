# Subir el tamaño de letra de los campos base a 16px (evitar el auto-zoom de iOS)

Safari en iPhone hace zoom automático cuando el usuario toca un campo cuya letra mide menos de 16px. Hoy los tres componentes base de formulario de Vittro usan 14px. Esta etapa los lleva a 16px en mobile, sin tocar nada más.

## Alcance

Solo tres archivos:

- `src/components/ui/input.tsx`
- `src/components/ui/textarea.tsx`
- `src/components/ui/select.tsx` (únicamente `SelectTrigger`)

No se tocan: `Login.tsx`, los overrides a `text-xs` de Configuración y Notificaciones, los inputs nativos sueltos (`phone-input.tsx`, `ClienteSearchPicker.tsx`, `PortalPublicoSection.tsx`), ni `SelectItem`. Ninguna lógica, validación ni dato.

---

## 1. Enfoque recomendado: clase Tailwind responsive, no token nuevo

**Propuesta: reemplazar `text-sm` por `text-base md:text-sm` en los tres componentes.**

Qué significa: en pantallas chicas (mobile, que es donde existe el problema) la letra pasa a 16px y el zoom desaparece. En desktop se mantiene en 14px, o sea que la app interna se ve exactamente igual que hoy en una laptop y no cambia la densidad visual de ninguna pantalla operativa.

Por qué no un token `--input-font-size`:

- Un token CSS no puede expresar por sí solo el corte por breakpoint; habría que crear dos tokens y un media query a mano, más código para el mismo resultado.
- El proyecto usa tokens semánticos para color, no para tipografía: `tailwind.config.ts` no extiende `fontSize`. Introducir un token tipográfico suelto para un solo caso rompe la convención en vez de reforzarla.
- `text-base md:text-sm` es exactamente el patrón que shadcn/ui adoptó como default en sus versiones nuevas por este mismo motivo, así que queda alineado con el upstream y cualquiera que lea el archivo lo entiende.

Documentación: un comentario de una línea arriba de cada clase explicando que los 16px en mobile son deliberados (evitan el auto-zoom de iOS) y que no deben bajarse. Con eso queda registrado en el sistema sin inventar infraestructura nueva.

Alternativa descartada: `text-base` a secas. Engordaría todas las pantallas internas en desktop, donde la densidad media-alta es intencional en Vittro.

## 2. Riesgo de layout

El riesgo es bajo y acotado, porque el cambio aplica solo por debajo del breakpoint `md`.

- **Alto del campo:** no cambia. `Input` y `SelectTrigger` tienen `h-10` (40px) fijo, y `Textarea` tiene `min-h-[80px]`. El alto está definido por la clase, no por el texto, así que 16px entra sin empujar nada. El padding vertical `py-2` tampoco se altera.
- **Íconos dentro del campo:** los que están posicionados en absoluto quedan igual, porque se anclan al alto del contenedor y no al texto. El caso a mirar es el `$` del `CurrencyInput`, que se centra con `top-1/2 -translate-y-1/2` sobre el contenedor: sigue centrado. El chevron del `SelectTrigger` está en un flex con `items-center`: sin cambios.
- **Placeholders largos:** este es el punto real a revisar. Con 16px, un placeholder que hoy entra justo puede quedar cortado en pantallas de 375px. Los casos concretos que revisaría en el checkeo visual son el buscador de clientes en Cobrar, el placeholder "Buscar por nombre, apellido, telefono o email" (ese es input nativo, no cambia en esta etapa) y los campos de motivo/descripción de Finanzas.
- **Campos con alto reducido a mano:** hay usos con `h-9` (Tareas, Recurrentes, MpDevices) y `h-7` (NotificationsBell). Los de `h-7` ya traen `text-xs` propio, así que ganan por especificidad y no cambian en esta etapa. Los de `h-9` (36px) sí pasarían a 16px: entra bien, pero se ve más apretado. Lo dejo señalado para verificar visualmente, no anticipo rotura.
- **Campos numéricos angostos:** los selects de código de país con ancho fijo (`w-[100px]`, `w-[110px]`) están en el portal público y ya tienen `text-base` propio, salvo `DatosClienteStep.tsx:154` que quedó en `text-sm` — no se toca en esta etapa, queda anotado como inconsistencia pendiente.

## 3. SelectTrigger y texto largo

Sí hay riesgo de truncamiento, pero ya está contemplado por el componente: `SelectTrigger` trae `[&>span]:line-clamp-1`, es decir que el valor seleccionado se corta con puntos suspensivos en una sola línea en vez de romper el layout.

Dónde se nota más al subir a 16px: los selects con ancho fijo `w-[180px]` y `w-[200px]` (Historial de caja, Anulaciones, Gestión de usuarios, filtros de Tareas). Con nombres de barbero largos o sucursales de nombre extenso, hoy ya se truncan; a 16px se truncan un poco antes. No se rompe nada, pero el valor visible es más corto.

Si eso molesta, la corrección natural es cambiar esos anchos fijos por `w-full sm:w-[180px]` en mobile — pero eso queda **fuera de esta etapa**, lo menciono solo para que sepas que existe la salida.

## 4. Antes / después del campo

El único cambio perceptible es la letra. El contorno del campo no se mueve.

```text
ANTES (mobile)                        DESPUES (mobile)
┌──────────────────────────┐          ┌──────────────────────────┐
│  Juan Perez              │ 40px     │  Juan Perez              │ 40px
└──────────────────────────┘          └──────────────────────────┘
   letra 14px                            letra 16px
   padding 12px lateral                  padding 12px lateral
   alto 40px  ← igual                    alto 40px  ← igual
   al tocar: la pantalla                 al tocar: no pasa nada,
   hace zoom y hay que                   el teclado sube y el
   volver a alejarla a mano              formulario queda en su lugar
```

- Alto del input: **40px antes y después**.
- Padding: **sin cambios** (`px-3 py-2`).
- Textarea: **mínimo 80px antes y después**.
- Desktop: **idéntico a hoy**, letra 14px.

## Detalle técnico

Un solo reemplazo de clase por archivo, más un comentario explicativo:

| Archivo | Línea | De | A |
|---|---|---|---|
| `src/components/ui/input.tsx` | 11 | `text-sm` | `text-base md:text-sm` |
| `src/components/ui/textarea.tsx` | 11 | `text-sm` | `text-base md:text-sm` |
| `src/components/ui/select.tsx` | 20 (`SelectTrigger`) | `text-sm` | `text-base md:text-sm` |

En `input.tsx` se conserva `file:text-sm` tal cual: es el botón de archivo, no el texto editable.

Los 15 campos con override propio a `text-xs` en Configuración y Notificaciones **van a seguir haciendo zoom** después de este cambio, porque su clase gana por especificidad. Se resuelven en la etapa siguiente.

## Validación después del build

En preview mobile (393px, que es el viewport actual):

1. Abrir un `DrawerForm` de alta (por ejemplo un gasto en Finanzas) y tocar un campo: no debe hacer zoom.
2. Abrir un select de filtro en Tareas: verificar que el valor no quede cortado de forma molesta.
3. Cobrar: verificar el `CurrencyInput` — el `$` debe seguir alineado con el número.
4. Un textarea de notas: verificar que el contador de caracteres siga en su lugar.
5. En desktop: confirmar que ninguna pantalla cambió de aspecto.
