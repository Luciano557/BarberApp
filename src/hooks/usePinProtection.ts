import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useOrganization } from '@/contexts/OrganizationContext';
import { useSucursal } from '@/contexts/SucursalContext';
import { toast } from 'sonner';

const UNLOCK_DURATION = 4 * 60 * 1000; // 4 minutes in milliseconds
const SESSION_KEY = 'pin_unlock_state';

interface UnlockState {
  isUnlocked: boolean;
  unlockedBy: string | null;
  unlockedAt: number | null;
}

export function usePinProtection() {
  const { user, canManageConfig } = useAuth();
  const { organization } = useOrganization();
  const [isUnlocked, setIsUnlocked] = useState(false);
  const [hasPinConfigured, setHasPinConfigured] = useState<boolean | null>(null);
  const [unlockedBy, setUnlockedBy] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const inactivityTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const activityListenerRef = useRef<(() => void) | null>(null);

  // Check if any barbero in the organization has a PIN configured
  const checkHasPinConfigured = useCallback(async () => {
    if (!user || !organization) {
      setHasPinConfigured(null);
      setIsLoading(false);
      return;
    }

    try {
      const { data, error } = await supabase
        .from('barberos')
        .select('id, pin_hash')
        .eq('organization_id', organization.id)
        .eq('activo', true)
        .not('pin_hash', 'is', null);

      if (error) throw error;
      setHasPinConfigured(data && data.length > 0);
    } catch (error) {
      console.error('Error checking PIN configuration:', error);
      setHasPinConfigured(false);
    } finally {
      setIsLoading(false);
    }
  }, [user, organization]);

  // Restore session from sessionStorage
  const restoreSession = useCallback(() => {
    try {
      const stored = sessionStorage.getItem(SESSION_KEY);
      if (stored) {
        const state: UnlockState = JSON.parse(stored);
        const now = Date.now();
        
        if (state.isUnlocked && state.unlockedAt && (now - state.unlockedAt) < UNLOCK_DURATION) {
          setIsUnlocked(true);
          setUnlockedBy(state.unlockedBy);
          return true;
        } else {
          sessionStorage.removeItem(SESSION_KEY);
        }
      }
    } catch {
      sessionStorage.removeItem(SESSION_KEY);
    }
    return false;
  }, []);

  // Save session to sessionStorage
  const saveSession = useCallback((unlocked: boolean, by: string | null) => {
    if (unlocked) {
      const state: UnlockState = {
        isUnlocked: true,
        unlockedBy: by,
        unlockedAt: Date.now()
      };
      sessionStorage.setItem(SESSION_KEY, JSON.stringify(state));
    } else {
      sessionStorage.removeItem(SESSION_KEY);
    }
  }, []);

  // Lock function
  const lock = useCallback(() => {
    setIsUnlocked(false);
    setUnlockedBy(null);
    saveSession(false, null);
    if (inactivityTimerRef.current) {
      clearTimeout(inactivityTimerRef.current);
    }
  }, [saveSession]);

  // Reset inactivity timer
  const resetInactivityTimer = useCallback(() => {
    if (inactivityTimerRef.current) {
      clearTimeout(inactivityTimerRef.current);
    }
    
    if (isUnlocked) {
      inactivityTimerRef.current = setTimeout(() => {
        lock();
        toast.info('Sesión bloqueada por inactividad');
      }, UNLOCK_DURATION);
    }
  }, [isUnlocked, lock]);

  // Validate PIN
  const validatePin = useCallback(async (pin: string, sucursalId?: string | null): Promise<{ success: boolean; userName?: string; error?: string }> => {
    if (!user) {
      return { success: false };
    }

    try {
      const { data, error } = await supabase.functions.invoke('validate-pin', {
        body: { pin, sucursal_id: sucursalId ?? null }
      });

      if (error) throw error;

      if (data.valid) {
        const userName = data.user_name;
        setIsUnlocked(true);
        setUnlockedBy(userName);
        saveSession(true, userName);
        resetInactivityTimer();
        return { success: true, userName };
      }

      return { success: false };
    } catch (error) {
      console.error('Error validating PIN:', error);
      return { success: false };
    }
  }, [user, saveSession, resetInactivityTimer]);

  // Setup activity listener
  useEffect(() => {
    if (isUnlocked) {
      const handleActivity = () => resetInactivityTimer();
      
      window.addEventListener('mousemove', handleActivity);
      window.addEventListener('keydown', handleActivity);
      window.addEventListener('click', handleActivity);
      window.addEventListener('scroll', handleActivity);

      activityListenerRef.current = () => {
        window.removeEventListener('mousemove', handleActivity);
        window.removeEventListener('keydown', handleActivity);
        window.removeEventListener('click', handleActivity);
        window.removeEventListener('scroll', handleActivity);
      };

      resetInactivityTimer();

      return () => {
        if (activityListenerRef.current) {
          activityListenerRef.current();
        }
        if (inactivityTimerRef.current) {
          clearTimeout(inactivityTimerRef.current);
        }
      };
    }
  }, [isUnlocked, resetInactivityTimer]);

  // Initialize
  useEffect(() => {
    checkHasPinConfigured();
    restoreSession();
  }, [checkHasPinConfigured, restoreSession]);

  // Determine if PIN protection is required
  // Required if user can manage config AND there's at least one PIN configured in the org
  const requiresPin = canManageConfig && hasPinConfigured === true;

  return {
    isUnlocked,
    hasPin: hasPinConfigured,
    unlockedBy,
    isLoading,
    requiresPin,
    validatePin,
    lock,
    checkHasPin: checkHasPinConfigured
  };
}
