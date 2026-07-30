/* TEMPORAL — harness de verificación visual del onboarding. Eliminar tras QA. */
import { useEffect, useLayoutEffect, useState } from 'react';
import { OnboardingContext } from '@/components/onboarding/OnboardingProvider';
import { OnboardingOverlay } from '@/components/onboarding/OnboardingOverlay';
import { OnboardingTooltip } from '@/components/onboarding/OnboardingTooltip';
import { ONBOARDING_STEPS } from '@/components/onboarding/steps';

const noop = () => {};

function Card({ id, title, h }: { id: string; title: string; h: number }) {
  return (
    <div id={id} className="rounded-xl border border-border bg-card p-4 mb-4" style={{ minHeight: h }}>
      <h3 className="font-semibold text-foreground">{title}</h3>
      <p className="text-sm text-muted-foreground mt-1">Contenido de ejemplo de la tarjeta.</p>
      <ul className="mt-3 space-y-1.5 text-sm text-foreground">
        <li>• Punto uno de la tarjeta señalada.</li>
        <li>• Punto dos de la tarjeta señalada.</li>
        <li>• Punto tres de la tarjeta señalada.</li>
      </ul>
    </div>
  );
}

export default function OnboardingHarness() {
  const params = new URLSearchParams(window.location.search);
  const index = Number(params.get('step') ?? '0');
  const step = ONBOARDING_STEPS[index] ?? ONBOARDING_STEPS[0];
  const [rect, setRect] = useState<DOMRect | null>(null);
  const [fits, setFits] = useState(true);

  useLayoutEffect(() => {
    const update = () => {
      const el = step.targetId ? document.getElementById(step.targetId) : null;
      setRect(el ? el.getBoundingClientRect() : null);
    };
    update();
    const t = setTimeout(update, 200);
    window.addEventListener('resize', update);
    return () => { clearTimeout(t); window.removeEventListener('resize', update); };
  }, [step]);

  useEffect(() => {
    const el = step.targetId ? document.getElementById(step.targetId) : null;
    el?.scrollIntoView({ block: 'center' });
  }, [step]);

  const value = {
    isActive: true,
    currentStep: step,
    currentIndex: index,
    totalSteps: ONBOARDING_STEPS.length,
    targetRect: rect,
    targetMissing: !step.isWelcome && !rect,
    next: noop,
    skip: noop,
    restart: noop,
    isAllowedTab: () => true,
    registerTabSetter: noop,
    registerSubTabSetter: noop,
    registerSectionOpener: noop,
    registerSubTabProbe: noop,
    setTooltipFits: setFits,
    tooltipFits: fits,
    notifyEvent: noop,
  } as never;

  return (
    <OnboardingContext.Provider value={value}>
      <div className="min-h-screen bg-background flex">
        <aside className="w-56 shrink-0 border-r border-border p-3 space-y-2">
          {['Inicio', 'Agenda', 'Cobrar', 'Finanzas'].map(t => (
            <div key={t} className="rounded-md px-3 py-2 text-sm text-muted-foreground">{t}</div>
          ))}
          <div id="mi-negocio-nav" className="rounded-md px-3 py-2 text-sm bg-accent text-foreground">Mi Negocio</div>
          <div className="rounded-md px-3 py-2 text-sm text-muted-foreground">Configuración</div>
        </aside>
        <main className="flex-1 p-6 max-w-4xl">
          <h1 className="text-xl font-semibold mb-4">Mi Negocio</h1>
          <div className="flex gap-2 mb-5">
            <div id="general-tab" className="rounded-md border border-border px-3 py-1.5 text-sm">General</div>
            <div id="sucursal-tab" className="rounded-md border border-border px-3 py-1.5 text-sm">Lomas de Zamora</div>
          </div>
          <Card id="equipo-general-section" title="Equipo" h={180} />
          <Card id="cuentas-sucursal-section" title="Acceso operativo" h={220} />
          <Card id="info-sucursal-card" title="Información de la sucursal" h={260} />
          <Card id="catalogo-section" title="Servicios, extras y productos" h={200} />
          <Card id="metodos-pago-section" title="Métodos de pago" h={180} />
        </main>
      </div>
      <OnboardingOverlay />
      <OnboardingTooltip />
    </OnboardingContext.Provider>
  );
}
