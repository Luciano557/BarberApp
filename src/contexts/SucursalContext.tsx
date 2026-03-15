import { createContext, useContext, useEffect, useState, useCallback, ReactNode } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './AuthContext';
import { useOrganization } from './OrganizationContext';

export interface Sucursal {
  id: string;
  organization_id: string;
  nombre: string;
  direccion: string | null;
  telefono: string | null;
  timezone: string | null;
  activa: boolean;
}

interface SucursalContextType {
  sucursales: Sucursal[];
  currentSucursal: Sucursal | null; // null = "Todas" (only for owner)
  isAllMode: boolean;
  isLoading: boolean;
  setCurrentSucursal: (id: string | null) => void;
  refreshSucursales: () => Promise<void>;
}

const SucursalContext = createContext<SucursalContextType | undefined>(undefined);

export function SucursalProvider({ children }: { children: ReactNode }) {
  const { user, isOwner, isGeneralManager, isLoading: authLoading } = useAuth();
  const { organization, isLoading: orgLoading } = useOrganization();
  const [sucursales, setSucursales] = useState<Sucursal[]>([]);
  const [currentSucursal, setCurrentSucursalState] = useState<Sucursal | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const fetchSucursales = useCallback(async () => {
    if (!user || !organization) {
      setSucursales([]);
      setCurrentSucursalState(null);
      setIsLoading(false);
      return;
    }

    try {
      const { data, error } = await supabase
        .from('sucursales')
        .select('*')
        .eq('organization_id', organization.id)
        .eq('activa', true)
        .order('nombre');

      if (error) {
        console.error('Error fetching sucursales:', error);
        setIsLoading(false);
        return;
      }

      const mapped: Sucursal[] = (data || []).map(s => ({
        id: s.id,
        organization_id: s.organization_id,
        nombre: s.nombre,
        direccion: s.direccion,
        telefono: s.telefono,
        timezone: s.timezone,
        activa: s.activa,
      }));

      setSucursales(mapped);

      // Set default sucursal
      if (mapped.length > 0 && !currentSucursal) {
        // Try to use the profile's default_sucursal_id
        const { data: profileData } = await supabase
          .from('profiles')
          .select('default_sucursal_id')
          .eq('id', user.id)
          .single();

        const defaultId = profileData?.default_sucursal_id;
        const defaultSuc = mapped.find(s => s.id === defaultId);

        if (isOwner || isGeneralManager) {
          // Owners and GMs default to their saved preference or first sucursal
          setCurrentSucursalState(defaultSuc || mapped[0]);
        } else {
          // Non-owners always get their assigned sucursal
          setCurrentSucursalState(defaultSuc || mapped[0]);
        }
      }
    } catch (error) {
      console.error('Error in fetchSucursales:', error);
    } finally {
      setIsLoading(false);
    }
  }, [user, organization, isOwner]);

  useEffect(() => {
    if (!authLoading && !orgLoading) {
      fetchSucursales();
    }
  }, [user, organization, authLoading, orgLoading]);

  const setCurrentSucursal = useCallback(async (id: string | null) => {
    if (id === null) {
      // "Todas" mode — only owners can do this
      setCurrentSucursalState(null);
    } else {
      const found = sucursales.find(s => s.id === id);
      if (found) {
        setCurrentSucursalState(found);
        // Persist preference
        if (user) {
          await supabase
            .from('profiles')
            .update({ default_sucursal_id: id })
            .eq('id', user.id);
        }
      }
    }
  }, [sucursales, user]);

  const isAllMode = isOwner && currentSucursal === null;

  return (
    <SucursalContext.Provider
      value={{
        sucursales,
        currentSucursal,
        isAllMode,
        isLoading: isLoading || authLoading || orgLoading,
        setCurrentSucursal,
        refreshSucursales: fetchSucursales,
      }}
    >
      {children}
    </SucursalContext.Provider>
  );
}

export function useSucursal() {
  const context = useContext(SucursalContext);
  if (context === undefined) {
    throw new Error('useSucursal must be used within a SucursalProvider');
  }
  return context;
}
