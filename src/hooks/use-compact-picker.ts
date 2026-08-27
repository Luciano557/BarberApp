import * as React from "react";

// Corte propio de los pickers de fecha/hora (DatePicker/TimePicker), no de
// política global de breakpoints. Deliberadamente distinto de useIsMobile
// (768px, incluye tablets chicas): la decisión de producto es que tablet se
// comporte como desktop acá (Popover), y solo el ancho de teléfono (<640px,
// el corte `sm:` que DESIGN.md ya documenta como dominante) cae a Drawer.
const COMPACT_QUERY = "(max-width: 639px)";

export function useIsCompactPicker(): boolean {
  const [isCompact, setIsCompact] = React.useState<boolean>(
    typeof window !== "undefined" ? window.matchMedia(COMPACT_QUERY).matches : false,
  );

  React.useEffect(() => {
    const mql = window.matchMedia(COMPACT_QUERY);
    const onChange = () => setIsCompact(mql.matches);
    mql.addEventListener("change", onChange);
    setIsCompact(mql.matches);
    return () => mql.removeEventListener("change", onChange);
  }, []);

  return isCompact;
}
