import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, ReactNode } from 'react';
import { ONBOARDING_STEPS, OnboardingStep } from './steps';
import { useOnboardingState } from '@/hooks/useOnboardingState';

interface OnboardingContextValue {
  isActive: boolean;
  currentStep: OnboardingStep | null;
  currentIndex: number;
  totalSteps: number;
  targetRect: DOMRect | null;
  next: () => void;
  skip: () => void;
  restart: () => void;
  isAllowedTab: (tabId: string) => boolean;
  registerTabSetter: (fn: ((tab: string) => void) | null) => void;
}

const OnboardingContext = createContext<OnboardingContextValue | null>(null);

export function useOnboarding() {
  const ctx = useContext(OnboardingContext);
  if (!ctx) throw new Error('useOnboarding must be used within OnboardingProvider');
  return ctx;
}

export function OnboardingProvider({ children }: { children: ReactNode }) {
  const { row, isLoading, isOwner, upsert } = useOnboardingState();
  const tabSetterRef = useRef<((tab: string) => void) | null>(null);
  const [currentIndex, setCurrentIndex] = useState<number>(-1);
  const [targetRect, setTargetRect] = useState<DOMRect | null>(null);

  const isActive = currentIndex >= 0 && currentIndex < ONBOARDING_STEPS.length;
  const currentStep = isActive ? ONBOARDING_STEPS[currentIndex] : null;

  // Auto-start for owners
  useEffect(() => {
    if (isLoading || !isOwner) return;
    if (currentIndex !== -1) return;
    const status = row?.status ?? 'pending';
    if (status === 'completed' || status === 'skipped') return;
    const resumeId = row?.current_step;
    const resumeIdx = resumeId ? ONBOARDING_STEPS.findIndex(s => s.id === resumeId) : 0;
    setCurrentIndex(resumeIdx >= 0 ? resumeIdx : 0);
    if (status === 'pending') {
      upsert({ status: 'in_progress', started_at: new Date().toISOString(), current_step: ONBOARDING_STEPS[0].id });
    }
  }, [isLoading, isOwner, row, currentIndex, upsert]);

  // Apply requiredTab on step change
  useEffect(() => {
    if (!currentStep) return;
    if (currentStep.requiredTab && tabSetterRef.current) {
      tabSetterRef.current(currentStep.requiredTab);
    }
  }, [currentStep]);

  // Track target rect
  useEffect(() => {
    if (!currentStep) { setTargetRect(null); return; }
    let raf = 0;
    const update = () => {
      const el = document.querySelector(`[data-onboarding-id="${currentStep.targetId}"]`) as HTMLElement | null;
      if (el) {
        const r = el.getBoundingClientRect();
        setTargetRect(prev => {
          if (prev && prev.top === r.top && prev.left === r.left && prev.width === r.width && prev.height === r.height) return prev;
          return r;
        });
      } else {
        setTargetRect(null);
      }
    };
    const tick = () => { update(); raf = requestAnimationFrame(tick); };
    raf = requestAnimationFrame(tick);
    window.addEventListener('resize', update);
    window.addEventListener('scroll', update, true);
    // Scroll into view once
    setTimeout(() => {
      const el = document.querySelector(`[data-onboarding-id="${currentStep.targetId}"]`);
      el?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }, 100);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('resize', update);
      window.removeEventListener('scroll', update, true);
    };
  }, [currentStep]);

  const next = useCallback(() => {
    setCurrentIndex(idx => {
      const nextIdx = idx + 1;
      const completedId = ONBOARDING_STEPS[idx]?.id;
      const newCompleted = completedId
        ? Array.from(new Set([...(row?.completed_steps ?? []), completedId]))
        : (row?.completed_steps ?? []);
      if (nextIdx >= ONBOARDING_STEPS.length) {
        upsert({
          status: 'completed',
          current_step: null,
          completed_steps: newCompleted,
          completed_at: new Date().toISOString(),
        });
        return -1;
      }
      upsert({
        status: 'in_progress',
        current_step: ONBOARDING_STEPS[nextIdx].id,
        completed_steps: newCompleted,
      });
      return nextIdx;
    });
  }, [row, upsert]);

  const skip = useCallback(() => {
    setCurrentIndex(-1);
    upsert({ status: 'skipped', current_step: null, completed_at: new Date().toISOString() });
  }, [upsert]);

  const restart = useCallback(() => {
    upsert({
      status: 'in_progress',
      current_step: ONBOARDING_STEPS[0].id,
      completed_steps: [],
      started_at: new Date().toISOString(),
      completed_at: null,
    });
    setCurrentIndex(0);
  }, [upsert]);

  const isAllowedTab = useCallback((tabId: string) => {
    if (!currentStep) return true;
    if (currentStep.requiredTab && tabId === currentStep.requiredTab) return true;
    if (currentStep.allowedTabs?.includes(tabId)) return true;
    // Step 1 (sidebar) only allows mi-negocio
    if (currentStep.id === 's1_sidebar' && tabId === 'mi-negocio') return true;
    return false;
  }, [currentStep]);

  const registerTabSetter = useCallback((fn: ((tab: string) => void) | null) => {
    tabSetterRef.current = fn;
  }, []);

  const value = useMemo<OnboardingContextValue>(() => ({
    isActive,
    currentStep,
    currentIndex,
    totalSteps: ONBOARDING_STEPS.length,
    targetRect,
    next,
    skip,
    restart,
    isAllowedTab,
    registerTabSetter,
  }), [isActive, currentStep, currentIndex, targetRect, next, skip, restart, isAllowedTab, registerTabSetter]);

  return <OnboardingContext.Provider value={value}>{children}</OnboardingContext.Provider>;
}
