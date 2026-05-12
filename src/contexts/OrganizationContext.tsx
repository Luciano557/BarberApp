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
  refreshOrganization: () => Promise<void>;
  updateOrganization: (updates: Partial<Organization>) => Promise<{ error: Error | null }>;
}

const OrganizationContext = createContext<OrganizationContextType | undefined>(undefined);

export function OrganizationProvider({ children }: { children: ReactNode }) {
  const { user, isLoading: authLoading } = useAuth();
  const [organization, setOrganization] = useState<Organization | null>(null);
  const [planFeatures, setPlanFeatures] = useState<PlanFeatures | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const fetchOrganization = async () => {
    if (!user) {
      setOrganization(null);
      setPlanFeatures(null);
      setIsLoading(false);
      return;
    }

    try {
      // Fetch organization from the user's profile
      const { data: orgData, error: orgError } = await supabase
        .from('organizations')
        .select('*')
        .single();

      if (orgError) {
        console.error('Error fetching organization:', orgError);
        setIsLoading(false);
        return;
      }

      if (orgData) {
        setOrganization(orgData as Organization);

        // Fetch plan features
        const { data: featuresData } = await supabase
          .from('plan_features')
          .select('*')
          .eq('plan', orgData.plan)
          .single();

        if (featuresData) {
          setPlanFeatures(featuresData as PlanFeatures);
        }
      }
    } catch (error) {
      console.error('Error in fetchOrganization:', error);
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
      const { error } = await supabase
        .from('organizations')
        .update(updates)
        .eq('id', organization.id);

      if (error) {
        return { error };
      }

      setOrganization(prev => prev ? { ...prev, ...updates } : null);
      return { error: null };
    } catch (error) {
      return { error: error as Error };
    }
  };

  useEffect(() => {
    if (!authLoading) {
      fetchOrganization();
    }
  }, [user, authLoading]);

  return (
    <OrganizationContext.Provider
      value={{
        organization,
        planFeatures,
        isLoading: isLoading || authLoading,
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
