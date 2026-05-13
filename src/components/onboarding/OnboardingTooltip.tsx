import { useEffect, useState } from 'react';
import { useOnboarding } from './OnboardingProvider';
import { Button } from '@/components/ui/button';
import { ArrowRight } from 'lucide-react';

const TOOLTIP_W = 340;
const MARGIN = 16;

export function OnboardingTooltip() {
  const { isActive, currentStep, currentIndex, totalSteps, targetRect, next, skip } = useOnboarding();
  const [vp, setVp] = useState({ w: typeof window !== 'undefined' ? window.innerWidth : 1024, h: typeof window !== 'undefined' ? window.innerHeight : 768 });

  useEffect(() => {
    const onResize = () => setVp({ w: window.innerWidth, h: window.innerHeight });
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  if (!isActive || !currentStep) return null;

  // Position
  let top = vp.h / 2 - 100;
  let left = vp.w / 2;
  let transform = 'translate(-50%, -50%)';
  let arrow: 'top' | 'bottom' | 'left' | 'right' | null = null;

  if (targetRect) {
    const spaceBelow = vp.h - targetRect.bottom;
    const spaceAbove = targetRect.top;
    const spaceRight = vp.w - targetRect.right;

    if (spaceBelow > 220) {
      top = targetRect.bottom + MARGIN;
      left = targetRect.left + targetRect.width / 2;
      transform = 'translate(-50%, 0)';
      arrow = 'top';
    } else if (spaceAbove > 220) {
      top = targetRect.top - MARGIN;
      left = targetRect.left + targetRect.width / 2;
      transform = 'translate(-50%, -100%)';
      arrow = 'bottom';
    } else if (spaceRight > TOOLTIP_W + 40) {
      top = targetRect.top + targetRect.height / 2;
      left = targetRect.right + MARGIN;
      transform = 'translate(0, -50%)';
      arrow = 'left';
    } else {
      top = targetRect.top + targetRect.height / 2;
      left = targetRect.left - MARGIN;
      transform = 'translate(-100%, -50%)';
      arrow = 'right';
    }

    // Clamp horizontally
    const halfW = TOOLTIP_W / 2;
    if (transform.startsWith('translate(-50%')) {
      left = Math.min(Math.max(left, halfW + 12), vp.w - halfW - 12);
    }
  }

  return (
    <div
      className="fixed z-[70] animate-fade-in"
      style={{ top, left, transform, width: TOOLTIP_W }}
    >
      <div className="relative rounded-xl border border-border bg-popover text-popover-foreground shadow-2xl p-4">
        {arrow && <Arrow direction={arrow} />}
        <div className="flex items-center justify-between mb-2">
          <span className="text-[11px] font-medium tracking-wide text-muted-foreground uppercase">
            Paso {currentIndex + 1} de {totalSteps}
          </span>
        </div>
        <h3 className="text-base font-semibold text-foreground">{currentStep.title}</h3>
        <p className="text-sm text-muted-foreground mt-1.5 leading-relaxed">{currentStep.description}</p>

        {currentStep.bullets && currentStep.bullets.length > 0 && (
          <ul className="mt-3 space-y-1.5">
            {currentStep.bullets.map((b, i) => (
              <li key={i} className="flex gap-2 text-sm text-foreground">
                <span className="mt-1.5 h-1 w-1 rounded-full bg-primary shrink-0" />
                <span className="leading-relaxed">{b}</span>
              </li>
            ))}
          </ul>
        )}

        <div className="flex items-center justify-between mt-4 pt-3 border-t border-border">
          <button
            onClick={skip}
            className="text-xs text-muted-foreground hover:text-foreground transition-colors"
          >
            Omitir tutorial
          </button>
          {currentStep.hideContinueButton ? (
            <span className="text-xs text-muted-foreground italic">Elegí una sucursal para continuar</span>
          ) : (
            <Button size="sm" onClick={next} className="gap-1.5">
              Continuar
              <ArrowRight className="h-3.5 w-3.5" />
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}

function Arrow({ direction }: { direction: 'top' | 'bottom' | 'left' | 'right' }) {
  const base = 'absolute w-3 h-3 bg-popover border-border rotate-45';
  const map = {
    top: `${base} -top-1.5 left-1/2 -translate-x-1/2 border-l border-t`,
    bottom: `${base} -bottom-1.5 left-1/2 -translate-x-1/2 border-r border-b`,
    left: `${base} -left-1.5 top-1/2 -translate-y-1/2 border-l border-b`,
    right: `${base} -right-1.5 top-1/2 -translate-y-1/2 border-r border-t`,
  } as const;
  return <div className={map[direction]} />;
}
