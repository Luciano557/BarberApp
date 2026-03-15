

# Fix: Sidebar arranca expandido en móvil al refrescar

## Problema
`useState(isMobile)` captura el valor inicial de `useIsMobile()` que es `undefined` (convertido a `false`) porque el efecto aún no corrió. Además, el viewport de 768px no califica como móvil (`< 768`).

## Solución

### 1. `src/hooks/use-mobile.tsx`
- Inicializar con `window.innerWidth` directamente en el estado (no `undefined`) para que el primer render ya tenga el valor correcto
- Cambiar breakpoint check a `<= 768` para incluir 768px

### 2. `src/components/AppSidebar.tsx`
- Sincronizar `collapsed` con `isMobile` usando un `useEffect` para que cuando el hook se actualice, el sidebar se colapse correctamente en móvil

```typescript
// En useIsMobile:
const [isMobile, setIsMobile] = useState(window.innerWidth <= MOBILE_BREAKPOINT);

// En AppSidebar, agregar efecto de sync:
useEffect(() => {
  if (isMobile) setCollapsed(true);
}, [isMobile]);
```

