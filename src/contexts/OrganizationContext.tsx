import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './AuthContext';

interface Organization {
  id: string;
  name: string;
  slug: string;
  plan: 'basico' | 'profesional' | 'premium';
  plan_expires_at: string | null;
  logo_url: string | null;
  phone: string | null;
  address: string | null;
  is_active: boolean;
  timezone: string;
  peticiones_vencimiento_dias: number;
  tareas_vencimiento_dias_default: number;
}

interface PlanFeatures {
  max_barbers: number;
  max_services: number;
  can_export_reports: boolean;
  can_view_analytics: boolean;
  price_monthly: number;
}

interface OrganizationContextType {
  organization: Organization | null;
  planFeatures: PlanFeatures | null;
  isLoading: boolean;
  error: string | null;
  refreshOrganization: () => Promise<void>;
  updateOrganization: (updates: Partial<Organization>) => Promise<{ error: Error | null }>;
}

const OrganizationContext = createContext<OrganizationContextType | undefined>(undefined);

export function OrganizationProvider({ children }: { children: ReactNode }) {
  const { user, isLoading: authLoading } = useAuth();
  const [organization, setOrganization] = useState<Organization | null>(null);
  const [planFeatures, setPlanFeatures] = useState<PlanFeatures | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchOrganization = async () => {
    setError(null);

    if (!user) {
      setOrganization(null);
      setPlanFeatures(null);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    console.info('[Org] phase=fetch:start');

    try {
      // 1. Resolver organization_id de forma determinística desde el profile.
      const { data: profileRow, error: profileErr } = await supabase
        .from('profiles')
        .select('organization_id')
        .eq('id', user.id)
        .maybeSingle();

      if (profileErr) throw profileErr;

      const orgId = profileRow?.organization_id;
      if (!orgId) {
        setOrganization(null);
        setPlanFeatures(null);
        setError('Tu cuenta no tiene una organización asignada.');
        console.info('[Org] phase=fetch:no-org');
        return;
      }

      // 2. Cargar organización por id explícito.
      const { data: orgData, error: orgErr } = await supabase
        .from('organizations')
        .select('*')
        .eq('id', orgId)
        .maybeSingle();

      if (orgErr) throw orgErr;
      if (!orgData) {
        setOrganization(null);
        setPlanFeatures(null);
        setError('No pudimos cargar tu organización.');
        return;
      }

      setOrganization(orgData as Organization);

      // 3. Plan features: si falla, no rompe el flujo principal.
      try {
        const { data: featuresData } = await supabase
          .from('plan_features')
          .select('*')
          .eq('plan', (orgData as Organization).plan)
          .maybeSingle();
        if (featuresData) setPlanFeatures(featuresData as PlanFeatures);
      } catch (planErr) {
        console.warn('[Org] phase=plan_features:error', planErr);
      }

      console.info('[Org] phase=fetch:success');
    } catch (err) {
      console.error('[Org] phase=fetch:error', err);
      setOrganization(null);
      setPlanFeatures(null);
      setError('No pudimos cargar tu organización. Reintentá en unos segundos.');
    } finally {
      setIsLoading(false);
    }
  };

  const refreshOrganization = async () => {
    await fetchOrganization();
  };

  const updateOrganization = async (updates: Partial<Organization>) => {
    if (!organization) {
      return { error: new Error('No organization found') };
    }

    try {
      const { error: updErr } = await supabase
        .from('organizations')
        .update(updates)
        .eq('id', organization.id);

      if (updErr) {
        return { error: updErr };
      }

      setOrganization(prev => prev ? { ...prev, ...updates } : null);
      return { error: null };
    } catch (err) {
      return { error: err as Error };
    }
  };

  useEffect(() => {
    if (!authLoading) {
      fetchOrganization();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id, authLoading]);

  return (
    <OrganizationContext.Provider
      value={{
        organization,
        planFeatures,
        isLoading: isLoading || authLoading,
        error,
        refreshOrganization,
        updateOrganization,
      }}
    >
      {children}
    </OrganizationContext.Provider>
  );
}

export function useOrganization() {
  const context = useContext(OrganizationContext);
  if (context === undefined) {
    throw new Error('useOrganization must be used within an OrganizationProvider');
  }
  return context;
}
