import * as React from "react";

const QUERY = "(prefers-reduced-motion: reduce)";

export function usePrefersReducedMotion() {
  const [prefersReducedMotion, setPrefersReducedMotion] = React.useState<boolean>(
    typeof window !== 'undefined' ? window.matchMedia(QUERY).matches : false
  );

  React.useEffect(() => {
    const mql = window.matchMedia(QUERY);
    const onChange = () => setPrefersReducedMotion(mql.matches);
    mql.addEventListener("change", onChange);
    setPrefersReducedMotion(mql.matches);
    return () => mql.removeEventListener("change", onChange);
  }, []);

  return prefersReducedMotion;
}
