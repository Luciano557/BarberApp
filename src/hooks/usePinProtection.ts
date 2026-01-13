import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';

const UNLOCK_DURATION = 30 * 60 * 1000; // 30 minutes in milliseconds
const SESSION_KEY = 'pin_unlock_state';

interface UnlockState {
  isUnlocked: boolean;
  unlockedBy: string | null;
  unlockedAt: number | null;
}

export function usePinProtection() {
  const { user, profile, canManageConfig } = useAuth();
  const [isUnlocked, setIsUnlocked] = useState(false);
  const [hasPin, setHasPin] = useState<boolean | null>(null);
  const [unlockedBy, setUnlockedBy] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const inactivityTimerRef = useRef<NodeJS.Timeout | null>(null);
  const activityListenerRef = useRef<(() => void) | null>(null);

  // Check if user has PIN configured
  const checkHasPin = useCallback(async () => {
    if (!user) {
      setHasPin(null);
      setIsLoading(false);
      return;
    }

    try {
      const { data, error } = await supabase
        .from('user_pins')
        .select('id')
        .eq('user_id', user.id)
        .maybeSingle();

      if (error) throw error;
      setHasPin(!!data);
    } catch (error) {
      console.error('Error checking PIN:', error);
      setHasPin(false);
    } finally {
      setIsLoading(false);
    }
  }, [user]);

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
  const validatePin = useCallback(async (pin: string): Promise<{ success: boolean; userName?: string }> => {
    if (!user) {
      return { success: false };
    }

    try {
      const { data, error } = await supabase.functions.invoke('validate-pin', {
        body: { pin }
      });

      if (error) throw error;

      if (data.valid) {
        const userName = data.user_name || profile?.full_name || user.email;
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
  }, [user, profile, saveSession, resetInactivityTimer]);

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
    checkHasPin();
    restoreSession();
  }, [checkHasPin, restoreSession]);

  // Determine if PIN protection is required
  // Only required if user has canManageConfig permission AND has a PIN set
  const requiresPin = canManageConfig && hasPin === true;

  return {
    isUnlocked,
    hasPin,
    unlockedBy,
    isLoading,
    requiresPin,
    validatePin,
    lock,
    checkHasPin
  };
}
