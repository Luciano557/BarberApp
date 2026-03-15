

# Fix sidebar en móvil: colapsado por defecto + siempre visible

## Problemas
1. En móvil el sidebar arranca expandido (w-56), ocupando demasiado espacio
2. Al hacer scroll el botón de colapsar desaparece porque el sidebar usa `sticky top-0` pero el contenido interno hace scroll

## Solución

### `src/components/AppSidebar.tsx`
- Usar `useIsMobile()` para inicializar `collapsed = true` en móvil
- Al seleccionar un tab en móvil, colapsar automáticamente el sidebar
- Cambiar el sidebar de `sticky` a `fixed` en móvil con `z-10`, y agregar un margen izquierdo al contenido principal para compensar

### `src/pages/Index.tsx`
- Pasar el estado `collapsed` desde el sidebar o usar el hook `useIsMobile` para agregar `ml-16` (ancho colapsado) al main en móvil

### Comportamiento resultante
- **Móvil**: sidebar arranca colapsado (solo iconos, 64px). Al tocar un item, navega y se mantiene colapsado. El botón de colapsar/expandir siempre está visible porque el sidebar es `fixed h-screen` con overflow interno.
- **Desktop**: sin cambios, arranca expandido como ahora.

