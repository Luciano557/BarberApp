import { useOnboarding } from './OnboardingProvider';

export function OnboardingOverlay() {
  const { isActive, currentStep, targetRect, targetMissing, tooltipFits } = useOnboarding();
  if (!isActive) return null;
  // El paso de bienvenida usa Dialog con su propio backdrop
  if (currentStep?.isWelcome) return null;

  const pad = 8;
  // En modo diálogo centrado no hay spotlight: evitaría recortes sobre el diálogo.
  const r = targetRect && !targetMissing && tooltipFits
    ? {
        top: Math.max(0, targetRect.top - pad),
        left: Math.max(0, targetRect.left - pad),
        width: targetRect.width + pad * 2,
        height: targetRect.height + pad * 2,
      }
    : null;

  // Sin target visible (mobile con sidebar colapsada, o target ausente):
  // fondo suave sin spotlight; el tooltip pasa a modo centrado.
  if (!r) {
    return <div className="fixed inset-0 z-[60] bg-foreground/40 backdrop-blur-[1px] animate-fade-in pointer-events-none" />;
  }

  const overlayCls = 'fixed bg-foreground/60 backdrop-blur-[1px] z-[60] transition-all duration-300';

  return (
    <>
      {/* Top */}
      <div className={overlayCls} style={{ top: 0, left: 0, right: 0, height: r.top }} />
      {/* Bottom */}
      <div className={overlayCls} style={{ top: r.top + r.height, left: 0, right: 0, bottom: 0 }} />
      {/* Left */}
      <div className={overlayCls} style={{ top: r.top, left: 0, width: r.left, height: r.height }} />
      {/* Right */}
      <div className={overlayCls} style={{ top: r.top, left: r.left + r.width, right: 0, height: r.height }} />
      {/* Spotlight ring */}
      <div
        className="fixed pointer-events-none rounded-xl ring-2 ring-primary/60 z-[61] transition-all duration-300"
        style={{ top: r.top, left: r.left, width: r.width, height: r.height, boxShadow: '0 0 0 9999px transparent' }}
      />
    </>
  );
}
