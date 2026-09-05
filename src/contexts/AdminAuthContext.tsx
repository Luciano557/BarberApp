import {
  createContext,
  type ReactNode,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import type { Session, User } from '@supabase/supabase-js';
import { useQueryClient } from '@tanstack/react-query';
import { adminSupabase } from '@/integrations/supabase/adminClient';

/* eslint-disable react-refresh/only-export-components -- provider contract intentionally co-locates its hook and auth predicates */

export const ADMIN_ALIAS = 'admin';
export const ADMIN_IDLE_TIMEOUT_MS = 30 * 60 * 1000;

const ADMIN_ROLE = 'platform_admin';
const GENERIC_CREDENTIAL_ERROR = 'Usuario o contraseña incorrectos.';

export type AdminAuthIssueCode =
  | 'configuration'
  | 'invalid_credentials'
  | 'forbidden'
  | 'session_expired'
  | 'unexpected';

export interface AdminAuthIssue {
  code: AdminAuthIssueCode;
  message: string;
}

export interface AdminSignInResult {
  error: Error | null;
}

export interface AdminAuthContextValue {
  user: User | null;
  session: Session | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  isConfigured: boolean;
  issue: AdminAuthIssue | null;
  signIn: (alias: string, password: string) => Promise<AdminSignInResult>;
  signOut: () => Promise<void>;
  refreshSession: () => Promise<void>;
  clearIssue: () => void;
}

const AdminAuthContext = createContext<AdminAuthContextValue | undefined>(undefined);

function technicalAdminEmail(): string | null {
  const value = import.meta.env.VITE_PLATFORM_ADMIN_EMAIL?.trim();
  return value || null;
}

export function isPlatformAdminUser(user: User | null | undefined): user is User {
  return user?.app_metadata?.platform_role === ADMIN_ROLE;
}

function issueError(issue: AdminAuthIssue): Error {
  return new Error(issue.message);
}

export function AdminAuthProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient();
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [issue, setIssue] = useState<AdminAuthIssue | null>(null);
  const validationSequence = useRef(0);
  const authenticatedUserId = useRef<string | null>(null);
  const idleTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastActivityAt = useRef(Date.now());
  const signInInFlight = useRef(false);

  const configuredEmail = technicalAdminEmail();
  const isConfigured = configuredEmail !== null;

  const clearAuthenticatedState = useCallback(() => {
    authenticatedUserId.current = null;
    setUser(null);
    setSession(null);
  }, []);

  const closeLocalSession = useCallback(
    async (nextIssue: AdminAuthIssue | null = null) => {
      validationSequence.current += 1;
      if (idleTimer.current) {
        clearTimeout(idleTimer.current);
        idleTimer.current = null;
      }

      try {
        // Local scope revokes only this isolated browser session. It neither
        // touches the tenant client nor signs out other users of the account.
        await adminSupabase.auth.signOut({ scope: 'local' });
      } finally {
        queryClient.removeQueries({ queryKey: ['platform-admin'] });
        clearAuthenticatedState();
        setIssue(nextIssue);
        setIsLoading(false);
      }
    },
    [clearAuthenticatedState, queryClient],
  );

  const validateSession = useCallback(
    async (candidate: Session | null): Promise<boolean> => {
      const sequence = ++validationSequence.current;

      if (!candidate) {
        clearAuthenticatedState();
        setIsLoading(false);
        return false;
      }

      if (authenticatedUserId.current !== candidate.user.id) {
        setIsLoading(true);
      }

      const { data, error } = await adminSupabase.auth.getUser();
      if (sequence !== validationSequence.current) return false;

      const currentUser = data.user;
      const isCurrentSession = currentUser?.id === candidate.user.id;
      if (error || !isCurrentSession) {
        await closeLocalSession({
          code: 'session_expired',
          message: 'La sesión administrativa venció. Volvé a ingresar.',
        });
        return false;
      }

      if (!isPlatformAdminUser(currentUser)) {
        await closeLocalSession({
          code: 'forbidden',
          message: 'Esta cuenta no tiene acceso al centro de administración.',
        });
        return false;
      }

      setSession({ ...candidate, user: currentUser });
      setUser(currentUser);
      authenticatedUserId.current = currentUser.id;
      setIssue(null);
      setIsLoading(false);
      return true;
    },
    [clearAuthenticatedState, closeLocalSession],
  );

  useEffect(() => {
    let mounted = true;

    const { data: { subscription } } = adminSupabase.auth.onAuthStateChange(
      (event, nextSession) => {
        // Supabase warns against awaiting auth methods inside this callback.
        window.setTimeout(() => {
          if (!mounted) return;
          if (event === 'SIGNED_IN' && signInInFlight.current) return;
          if (event === 'SIGNED_OUT' || !nextSession) {
            validationSequence.current += 1;
            queryClient.removeQueries({ queryKey: ['platform-admin'] });
            clearAuthenticatedState();
            setIsLoading(false);
            return;
          }
          void validateSession(nextSession);
        }, 0);
      },
    );

    void adminSupabase.auth.getSession()
      .then(({ data }) => {
        if (mounted) return validateSession(data.session);
        return false;
      })
      .catch(() => {
        if (!mounted) return;
        clearAuthenticatedState();
        setIssue({
          code: 'unexpected',
          message: 'No pudimos verificar la sesión administrativa.',
        });
        setIsLoading(false);
      });

    return () => {
      mounted = false;
      validationSequence.current += 1;
      subscription.unsubscribe();
    };
  }, [clearAuthenticatedState, queryClient, validateSession]);

  const hasActiveAdminSession = Boolean(
    session && user && isPlatformAdminUser(user),
  );

  useEffect(() => {
    if (!hasActiveAdminSession) {
      if (idleTimer.current) {
        clearTimeout(idleTimer.current);
        idleTimer.current = null;
      }
      return;
    }

    const expireForInactivity = () => {
      void closeLocalSession({
        code: 'session_expired',
        message: 'La sesión administrativa se cerró por inactividad.',
      });
    };

    const armTimer = () => {
      if (idleTimer.current) clearTimeout(idleTimer.current);
      const elapsed = Date.now() - lastActivityAt.current;
      const remaining = ADMIN_IDLE_TIMEOUT_MS - elapsed;
      if (remaining <= 0) {
        expireForInactivity();
        return;
      }
      idleTimer.current = setTimeout(expireForInactivity, remaining);
    };

    let lastActivityHandledAt = 0;
    const onActivity = () => {
      const now = Date.now();
      if (now - lastActivityAt.current >= ADMIN_IDLE_TIMEOUT_MS) {
        expireForInactivity();
        return;
      }
      if (now - lastActivityHandledAt < 1_000) return;
      lastActivityHandledAt = now;
      lastActivityAt.current = now;
      armTimer();
    };

    const onVisibilityChange = () => {
      if (document.visibilityState === 'visible') onActivity();
    };

    lastActivityAt.current = Date.now();
    armTimer();
    const activityEvents: Array<keyof WindowEventMap> = [
      'keydown',
      'pointerdown',
      'pointermove',
      'scroll',
      'touchstart',
    ];
    activityEvents.forEach((eventName) => {
      window.addEventListener(eventName, onActivity, { passive: true });
    });
    document.addEventListener('visibilitychange', onVisibilityChange);

    return () => {
      if (idleTimer.current) {
        clearTimeout(idleTimer.current);
        idleTimer.current = null;
      }
      activityEvents.forEach((eventName) => {
        window.removeEventListener(eventName, onActivity);
      });
      document.removeEventListener('visibilitychange', onVisibilityChange);
    };
  }, [closeLocalSession, hasActiveAdminSession]);

  const signIn = useCallback(
    async (alias: string, password: string): Promise<AdminSignInResult> => {
      setIssue(null);

      if (!configuredEmail) {
        const nextIssue: AdminAuthIssue = {
          code: 'configuration',
          message: 'El acceso administrativo no está configurado en este entorno.',
        };
        setIssue(nextIssue);
        return { error: issueError(nextIssue) };
      }

      if (alias.trim().toLowerCase() !== ADMIN_ALIAS) {
        const nextIssue: AdminAuthIssue = {
          code: 'invalid_credentials',
          message: GENERIC_CREDENTIAL_ERROR,
        };
        setIssue(nextIssue);
        return { error: issueError(nextIssue) };
      }

      setIsLoading(true);
      signInInFlight.current = true;
      try {
        const { data, error } = await adminSupabase.auth.signInWithPassword({
          email: configuredEmail,
          password,
        });

        if (error || !data.session) {
          const nextIssue: AdminAuthIssue = {
            code: 'invalid_credentials',
            message: GENERIC_CREDENTIAL_ERROR,
          };
          clearAuthenticatedState();
          setIssue(nextIssue);
          setIsLoading(false);
          return { error: issueError(nextIssue) };
        }

        const valid = await validateSession(data.session);
        if (!valid) {
          const nextIssue: AdminAuthIssue = {
            code: 'forbidden',
            message: GENERIC_CREDENTIAL_ERROR,
          };
          setIssue(nextIssue);
          return { error: issueError(nextIssue) };
        }

        return { error: null };
      } catch {
        const nextIssue: AdminAuthIssue = {
          code: 'unexpected',
          message: 'No pudimos iniciar la sesión administrativa. Reintentá.',
        };
        clearAuthenticatedState();
        setIssue(nextIssue);
        setIsLoading(false);
        return { error: issueError(nextIssue) };
      } finally {
        signInInFlight.current = false;
      }
    },
    [clearAuthenticatedState, configuredEmail, validateSession],
  );

  const signOut = useCallback(async () => {
    await closeLocalSession();
  }, [closeLocalSession]);

  const refreshSession = useCallback(async () => {
    const { data } = await adminSupabase.auth.getSession();
    await validateSession(data.session);
  }, [validateSession]);

  const value = useMemo<AdminAuthContextValue>(
    () => ({
      user,
      session,
      isLoading,
      isAuthenticated: hasActiveAdminSession,
      isConfigured,
      issue,
      signIn,
      signOut,
      refreshSession,
      clearIssue: () => setIssue(null),
    }),
    [hasActiveAdminSession, isConfigured, isLoading, issue, refreshSession, session, signIn, signOut, user],
  );

  return (
    <AdminAuthContext.Provider value={value}>
      {children}
    </AdminAuthContext.Provider>
  );
}

export function useAdminAuth(): AdminAuthContextValue {
  const context = useContext(AdminAuthContext);
  if (!context) {
    throw new Error('useAdminAuth must be used within an AdminAuthProvider');
  }
  return context;
}
