import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Plus, Edit2, Save, X, Lock, Mail, UserX, UserCheck, Shield, Scissors, ChevronDown, Users, KeyRound, Copy, AlertTriangle, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { PhoneInput, type PhoneInputChange } from '@/components/ui/phone-input';
import { formatPhoneDisplay } from '@/lib/phone';
import { CurrencyInput } from '@/components/ui/currency-input';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Barber, CompensationType, TeamRole, getBarberDisplayName } from '@/types/barbershop';
import { AppRole, useAuth } from '@/contexts/AuthContext';

import { InviteUserDialog } from '@/components/InviteUserDialog';
import { ExtrasCompensacion } from './ExtrasCompensacion';
import { StaffPinDialog } from '@/components/StaffPinDialog';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { BarberSucursalesGeneralSection } from './BarberSucursalesGeneralSection';

// --- Role utilities ---
const ROLE_HIERARCHY: Record<AppRole, number> = {
  owner: 0,
  general_manager: 1,
  manager: 2,
  barber: 3,
  sucursal_account: 4,
  otros: 5,
};

const getRoleLabel = (role: AppRole) => {
  switch (role) {
    case 'owner': return 'Dueño';
    case 'general_manager': return 'Encargado General';
    case 'manager': return 'Encargado de Sucursal';
    case 'barber': return 'Barbero';
    case 'otros': return 'Otros';
  }
};

const getRoleBadgeVariant = (role: AppRole): 'default' | 'secondary' | 'outline' => {
  switch (role) {
    case 'owner': case 'general_manager': return 'default';
    case 'manager': return 'secondary';
    case 'barber': case 'otros': return 'outline';
  }
};

const getRoleIcon = (role: AppRole) => {
  switch (role) {
    case 'owner': case 'general_manager': return <Shield className="w-3 h-3" />;
    case 'manager': return <UserCheck className="w-3 h-3" />;
    case 'barber': return <Scissors className="w-3 h-3" />;
    case 'otros': return <Users className="w-3 h-3" />;
  }
};

const ASSIGNABLE_ROLES: AppRole[] = ['general_manager', 'manager', 'barber', 'otros'];

// Stable form data type — shared between EquipoUnificado and StaffForm
type StaffFormData = {
  firstName: string;
  lastName: string;
  phone: string;
  commission: string;
  address: string;
  dni: string;
  roles: AppRole[];
  compensationType: CompensationType;
  fixedSalary: string;
  payDay: string;
};

// Enforce valid role combinations when user toggles a role
function enforceRoleRules(current: AppRole[], toggled: AppRole, checked: boolean): AppRole[] {
  let next = new Set(current);
  if (checked) next.add(toggled); else next.delete(toggled);

  if (checked) {
    if (toggled === 'otros') {
      // 'otros' is exclusive
      next = new Set<AppRole>(['otros']);
    } else {
      // Any non-'otros' role removes 'otros'
      next.delete('otros');
      // Hierarchical roles are mutually exclusive
      if (toggled === 'owner') { next.delete('general_manager'); next.delete('manager'); }
      if (toggled === 'general_manager') { next.delete('owner'); next.delete('manager'); }
      if (toggled === 'manager') { next.delete('owner'); next.delete('general_manager'); }
    }
  }
  if (next.size === 0) next.add('barber');
  return Array.from(next);
}

// --- New role helpers (UI-only) ---
function getHierarchicalRole(roles: AppRole[]): 'owner' | 'general_manager' | 'manager' | null {
  if (roles.includes('owner')) return 'owner';
  if (roles.includes('general_manager')) return 'general_manager';
  if (roles.includes('manager')) return 'manager';
  return null;
}

function hasOperationalBarber(roles: AppRole[]): boolean {
  return roles.includes('barber');
}

function normalizeRoles(roles: AppRole[]): AppRole[] {
  let set = new Set(roles);
  if (set.has('owner')) {
    set.delete('manager');
    set.delete('general_manager');
    set.delete('otros');
  }
  // Never both hierarchical at once (defensive)
  if (set.has('manager') && set.has('general_manager')) {
    set.delete('general_manager');
  }
  // Remove 'otros' if any other role is present
  if (set.size > 1 && set.has('otros')) set.delete('otros');
  if (set.size === 1 && set.has('otros')) return ['otros'];
  if (set.size === 0) return ['otros'];
  // Stable order
  const order: AppRole[] = ['owner', 'general_manager', 'manager', 'barber', 'otros'];
  return order.filter(r => set.has(r));
}

function toggleHierarchical(roles: AppRole[], target: 'general_manager' | 'manager'): AppRole[] {
  const set = new Set(roles);
  if (set.has(target)) {
    set.delete(target);
  } else {
    set.add(target);
    if (target === 'general_manager') set.delete('manager');
    else set.delete('general_manager');
    set.delete('otros');
  }
  return normalizeRoles(Array.from(set));
}

function toggleBarber(roles: AppRole[]): AppRole[] {
  const set = new Set(roles);
  if (set.has('barber')) set.delete('barber');
  else { set.add('barber'); set.delete('otros'); }
  return normalizeRoles(Array.from(set));
}

// --- Selectable role card component ---
interface RoleCardProps {
  icon: React.ReactNode;
  title: string;
  description: string;
  selected: boolean;
  state?: 'normal' | 'replaceable' | 'disabled';
  auxiliaryLabel?: string;
  onClick?: () => void;
}

const RoleCard: React.FC<RoleCardProps> = ({ icon, title, description, selected, state = 'normal', auxiliaryLabel, onClick }) => {
  const isDisabled = state === 'disabled';
  const isReplaceable = state === 'replaceable';

  const base = 'w-full text-left rounded-lg border p-3 transition-colors duration-150 flex gap-3 items-start';
  const stateClass = isDisabled
    ? 'border-border bg-muted/40 opacity-50 cursor-not-allowed'
    : selected
    ? 'border-primary bg-primary/5'
    : isReplaceable
    ? 'border-border bg-background opacity-60 hover:opacity-80'
    : 'border-border bg-background hover:bg-accent/40';

  return (
    <button
      type="button"
      disabled={isDisabled}
      onClick={onClick}
      className={`${base} ${stateClass}`}
      aria-pressed={selected}
    >
      <span className={`mt-0.5 ${selected ? 'text-primary' : 'text-muted-foreground'}`}>
        {icon}
      </span>
      <span className="flex-1 min-w-0">
        <span className="flex items-center gap-2">
          <span className={`text-sm ${selected ? 'font-medium text-foreground' : 'text-foreground'}`}>{title}</span>
          {selected && <Check className="h-3.5 w-3.5 text-primary" />}
        </span>
        <span className="block text-xs text-muted-foreground mt-0.5">{description}</span>
        {auxiliaryLabel && (
          <span className="block text-[11px] text-muted-foreground mt-1 italic">{auxiliaryLabel}</span>
        )}
      </span>
    </button>
  );
};

interface UserProfile {
  id: string;
  email: string;
  full_name: string | null;
  barbero_id: string | null;
}

interface UserRole {
  user_id: string;
  role: AppRole;
}

interface EquipoUnificadoProps {
  sucursalId: string;
  organizationId: string;
  barbers: Barber[];
  allBarbers: Barber[];
  sucursales?: { id: string; nombre: string }[];
  onAddBarber: (barber: Omit<Barber, 'id' | 'uid'>) => void;
  onUpdateBarber: (id: string, updates: Partial<Barber>) => void | Promise<void>;
  onRefreshBarbers?: () => Promise<void> | void;
  /**
   * 'sucursal' (default): comportamiento histórico — administra el equipo de una
   * sucursal específica. 'general': panel global del negocio, agrega gestión de
   * sucursal principal (doble escritura) y secundarias recurrentes por barbero.
   */
  mode?: 'sucursal' | 'general';
  /** En mode='general', sucursales activas para los selects internos. */
  sucursalesActivas?: { id: string; nombre: string }[];
  /** En mode='general', requerido para crear nuevos barberos (sucursal principal). */
  onAddBarberToSucursal?: (barber: Omit<Barber, 'id' | 'uid'>, sucursalId: string) => void;
}

interface ToggleConfirm {
  barber: Barber;
  action: 'activate' | 'deactivate';
}

export function EquipoUnificado({
  sucursalId, organizationId, barbers, allBarbers, sucursales = [], onAddBarber, onUpdateBarber, onRefreshBarbers,
  mode = 'sucursal', sucursalesActivas, onAddBarberToSucursal,
}: EquipoUnificadoProps) {
  const isGeneralMode = mode === 'general';
  const sucursalesForSection = sucursalesActivas ?? sucursales;
  const [isAdding, setIsAdding] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [activeSubTab, setActiveSubTab] = useState<'active' | 'inactive'>('active');
  const [inviteBarber, setInviteBarber] = useState<Barber | null>(null);
  const [pinDialogBarber, setPinDialogBarber] = useState<Barber | null>(null);
  const [barberPinStatus, setBarberPinStatus] = useState<Record<string, boolean>>({});
  const [toggleConfirm, setToggleConfirm] = useState<ToggleConfirm | null>(null);

  const { roles: callerRoles } = useAuth();
  const callerCanReplaceManager = callerRoles.includes('owner') || callerRoles.includes('general_manager');

  // Conflict resolution dialogs (manager replacement / stale role)
  const [replaceMgrDialog, setReplaceMgrDialog] = useState<{
    payload: any;
    currentManagerName: string;
    currentManagerBarberoId: string;
    newMemberName: string;
    onResolved: (res: any) => void;
  } | null>(null);
  const [staleMgrDialog, setStaleMgrDialog] = useState<{
    payload: any;
    conflictName: string | null;
    conflictEmail: string | null;
    onResolved: (res: any) => void;
  } | null>(null);
  // Refs to prevent double-resolution race when AlertDialogAction confirms
  // (Radix closes the dialog → onOpenChange fires before the action handler completes).
  const resolvingReplaceDialogRef = useRef(false);
  const resolvingStaleDialogRef = useRef(false);

  // User/role data
  const [orgUsers, setOrgUsers] = useState<UserProfile[]>([]);
  const [userRoles, setUserRoles] = useState<UserRole[]>([]);
  const [accessEmails, setAccessEmails] = useState<Record<string, string | null>>({});

  // Access UI state (per barber)
  const [emailDrafts, setEmailDrafts] = useState<Record<string, string>>({});
  const [generatedCodes, setGeneratedCodes] = useState<Record<string, { email: string; password: string }>>({});
  const [confirmRegen, setConfirmRegen] = useState<{ barberId: string; email: string; isRegistered: boolean } | null>(null);
  const [regenCountdown, setRegenCountdown] = useState(0);
  const [savingAccess, setSavingAccess] = useState<string | null>(null);


  const [formData, setFormData] = useState({
    firstName: '', lastName: '', phone: '', commission: '40', address: '', dni: '', roles: ['barber'] as AppRole[],
    compensationType: 'comision' as CompensationType, fixedSalary: '', payDay: '1',
  });
  // En general mode, sucursal principal a usar al crear un nuevo barbero.
  const [addPrincipalSucursalId, setAddPrincipalSucursalId] = useState<string>('');

  const activeBarbers = barbers.filter(b => b.active);
  const inactiveBarbers = barbers.filter(b => !b.active);

  // Fetch PIN status
  const fetchPinStatus = useCallback(async () => {
    if (barbers.length === 0) return;
    try {
      const { data, error } = await supabase.rpc('barberos_pin_status', { _ids: barbers.map(b => b.id) });
      if (error) throw error;
      const status: Record<string, boolean> = {};
      data?.forEach((b: { id: string; has_pin: boolean }) => { status[b.id] = !!b.has_pin; });
      setBarberPinStatus(status);
    } catch (error) {
      console.error('Error fetching PIN status:', error);
    }
  }, [barbers]);

  // Fetch org users and roles
  const fetchOrgUsers = useCallback(async () => {
    if (!organizationId) return;
    const { data } = await supabase.from('profiles').select('id, email, full_name, barbero_id').eq('organization_id', organizationId);
    if (data) setOrgUsers(data);
  }, [organizationId]);

  const fetchUserRoles = useCallback(async () => {
    const { data } = await supabase.from('user_roles').select('user_id, role');
    if (data) setUserRoles(data as UserRole[]);
  }, []);

  const fetchAccessEmails = useCallback(async () => {
    if (barbers.length === 0) return;
    const { data } = await supabase.from('barberos').select('id, access_email').in('id', barbers.map(b => b.id));
    if (data) {
      const map: Record<string, string | null> = {};
      data.forEach((b: any) => { map[b.id] = b.access_email ?? null; });
      setAccessEmails(map);
    }
  }, [barbers]);

  useEffect(() => { fetchPinStatus(); }, [fetchPinStatus]);
  useEffect(() => { fetchOrgUsers(); fetchUserRoles(); fetchAccessEmails(); }, [fetchOrgUsers, fetchUserRoles, fetchAccessEmails]);


  // Get linked user for a barber
  const getLinkedUser = (barberId: string): UserProfile | undefined =>
    orgUsers.find(u => u.barbero_id === barberId);

  // Get roles for a user
  const getUserRoles = (userId: string): AppRole[] =>
    userRoles.filter(r => r.user_id === userId).map(r => r.role);

  // Get all roles for a barber (through linked user)
  const getBarberRoles = (barber: Barber): AppRole[] => {
    const linkedUser = getLinkedUser(barber.id);
    if (!linkedUser) return [];
    return getUserRoles(linkedUser.id);
  };

  // Get the highest role for a barber (for sorting) — uses display roles (rol_equipo first)
  const getBarberHighestRole = (barber: Barber): AppRole | null => {
    const linkedUser = getLinkedUser(barber.id);
    const roles = linkedUser ? getUserRoles(linkedUser.id) : rolEquipoToRolesSafe(barber.teamRole);
    if (roles.length === 0) return null;
    return roles.sort((a, b) => ROLE_HIERARCHY[a] - ROLE_HIERARCHY[b])[0];
  };

  // Local helper available before rolEquipoToRoles is defined below
  function rolEquipoToRolesSafe(re: string | null | undefined): AppRole[] {
    switch (re) {
      case 'owner': return ['owner'];
      case 'general_manager': return ['general_manager'];
      case 'manager': return ['manager'];
      case 'barbero': return ['barber'];
      case 'otros': return ['otros'];
      default: return [];
    }
  }

  // Sort barbers by role hierarchy
  const sortByHierarchy = (list: Barber[]): Barber[] => {
    return [...list].sort((a, b) => {
      const roleA = getBarberHighestRole(a);
      const roleB = getBarberHighestRole(b);
      const hierarchyA = roleA ? ROLE_HIERARCHY[roleA] : 99;
      const hierarchyB = roleB ? ROLE_HIERARCHY[roleB] : 99;
      if (hierarchyA !== hierarchyB) return hierarchyA - hierarchyB;
      return a.firstName.localeCompare(b.firstName);
    });
  };

  // Map AppRole[] -> rol_equipo (single canonical)
  const rolesToRolEquipo = (roles: AppRole[]): 'owner' | 'general_manager' | 'manager' | 'barbero' | 'otros' => {
    if (roles.includes('owner')) return 'owner';
    if (roles.includes('general_manager')) return 'general_manager';
    if (roles.includes('manager')) return 'manager';
    if (roles.includes('barber')) return 'barbero';
    return 'otros';
  };

  // Map rol_equipo -> AppRole[] (for visual init when there's no linked user)
  const rolEquipoToRoles = (re: string | null | undefined): AppRole[] => {
    switch (re) {
      case 'owner': return ['owner'];
      case 'general_manager': return ['general_manager'];
      case 'manager': return ['manager'];
      case 'barbero': return ['barber'];
      case 'otros': return ['otros'];
      default: return ['barber'];
    }
  };

  // Visual cargo source of truth (priority):
  // 1) barberos.roles_equipo (multirol)
  // 2) barberos.rol_equipo (rol principal)
  // 3) user_roles del usuario vinculado (fallback)
  // 4) ['barber'] default
  const getDisplayRoles = (barber: Barber): AppRole[] => {
    if (barber.rolesEquipo && barber.rolesEquipo.length > 0) return barber.rolesEquipo;
    const fromTeamRole = rolEquipoToRoles(barber.teamRole);
    if (fromTeamRole.length > 0) return fromTeamRole;
    const linkedUser = getLinkedUser(barber.id);
    if (linkedUser) {
      const ur = getUserRoles(linkedUser.id);
      if (ur.length > 0) return ur;
    }
    return ['barber'];
  };

  // Centralized call to edge function — always returns a controlled result
  type AccessFnPayload = {
    barberoId: string;
    accessEmail?: string | null;
    roles?: AppRole[];
    rolEquipo?: any;
    regenerateAccess?: boolean;
    sucursalId?: string | null;
    replaceExistingManager?: boolean;
    existingManagerBarberoId?: string | null;
    resolveStaleManagerConflict?: boolean;
  };
  type AccessFnResult = {
    ok: boolean;
    code?: string;
    error?: string;
    data?: any;
    tempPassword?: string | null;
    email?: string | null;
  };
  const callAccessFn = async (payload: AccessFnPayload): Promise<AccessFnResult> => {
    const body: any = {
      barberoId: payload.barberoId,
      organizationId,
      sucursalId: payload.sucursalId !== undefined ? payload.sucursalId : sucursalId,
      accessEmail: payload.accessEmail,
      roles: payload.roles,
      rolEquipo: payload.rolEquipo,
      regenerateAccess: payload.regenerateAccess ?? false,
    };
    if (payload.replaceExistingManager) body.replaceExistingManager = true;
    if (payload.existingManagerBarberoId) body.existingManagerBarberoId = payload.existingManagerBarberoId;
    if (payload.resolveStaleManagerConflict) body.resolveStaleManagerConflict = true;

    try {
      console.debug('[update-team-member-access] payload', body);
      const { data, error } = await supabase.functions.invoke('update-team-member-access', { body });
      if (error) {
        // FunctionsHttpError: in supabase-js v2, error.context IS the Response,
        // but some versions wrap it as { response }. Handle both.
        let parsed: any = null;
        const ctx: any = (error as any)?.context;
        const ctxResp: any =
          ctx && typeof ctx.clone === 'function' ? ctx :
          ctx?.response && typeof ctx.response.clone === 'function' ? ctx.response :
          null;
        if (ctxResp) {
          try {
            parsed = await ctxResp.clone().json();
          } catch {
            try {
              const txt = await ctxResp.clone().text();
              try { parsed = JSON.parse(txt); } catch { parsed = null; }
            } catch { parsed = null; }
          }
        }
        // Fallback: parse JSON embedded in error.message ("...returned 409: Error, {json}")
        if (!parsed && typeof (error as any)?.message === 'string') {
          const msg: string = (error as any).message;
          const idx = msg.indexOf('{');
          if (idx >= 0) {
            try { parsed = JSON.parse(msg.slice(idx)); } catch { parsed = null; }
          }
        }
        return {
          ok: false,
          code: parsed?.code,
          error: parsed?.error || (error as any).message || 'Error en la solicitud',
          data: parsed,
        };
      }
      if ((data as any)?.error) {
        return { ok: false, code: (data as any)?.code, error: (data as any).error, data };
      }
      return { ok: true, tempPassword: (data as any)?.tempPassword, email: (data as any)?.email, data };
    } catch (e: any) {
      return { ok: false, error: e?.message || 'Error en la solicitud' };
    }
  };

  // Wrapper: handles MANAGER_REPLACE_REQUIRED / STALE_MANAGER_ROLE via dialogs.
  // Returns the final result after the user has resolved any conflict (or cancelled).
  const submitWithConflictHandling = async (
    payload: any,
    newMemberName: string,
  ): Promise<any> => {
    const res = await callAccessFn(payload);
    if (res.ok) return res;

    if (res.code === 'MANAGER_REPLACE_REQUIRED') {
      if (!callerCanReplaceManager) {
        toast.error('Solo el dueño o encargado general pueden reemplazar a un Encargado existente');
        return res;
      }
      return await new Promise<any>((resolve) => {
        setReplaceMgrDialog({
          payload,
          currentManagerName: res.data?.currentManagerName ?? 'el Encargado actual',
          currentManagerBarberoId: res.data?.currentManagerBarberoId ?? '',
          newMemberName,
          onResolved: (r) => resolve(r),
        });
      });
    }

    if (res.code === 'STALE_MANAGER_ROLE') {
      if (!callerCanReplaceManager) {
        toast.error('Solo el dueño o encargado general pueden corregir esta inconsistencia');
        return res;
      }
      return await new Promise<any>((resolve) => {
        setStaleMgrDialog({
          payload,
          conflictName: res.data?.conflictName ?? null,
          conflictEmail: res.data?.conflictEmail ?? null,
          onResolved: (r) => resolve(r),
        });
      });
    }

    return res;
  };
  const verifyRolEquipo = async (barberoId: string, expected: string): Promise<boolean> => {
    const { data } = await supabase.from('barberos').select('rol_equipo').eq('id', barberoId).maybeSingle();
    return (data as any)?.rol_equipo === expected;
  };

  // Role change handler (uses edge function for security/consistency)
  const handleChangeRoles = async (barberId: string, newRoles: AppRole[]) => {
    if (newRoles.length === 0) {
      toast.error('Debe tener al menos un cargo');
      return;
    }
    const linkedUser = getLinkedUser(barberId);
    if (linkedUser) {
      const currentRoles = getUserRoles(linkedUser.id);
      if (currentRoles.includes('owner') && !newRoles.includes('owner')) {
        toast.error('No se puede quitar el cargo de dueño');
        return;
      }
    }
    const rolEquipo = rolesToRolEquipo(newRoles);
    const targetBarber = barbers.find(b => b.id === barberId) ?? allBarbers.find(b => b.id === barberId);
    const memberName = targetBarber ? `${targetBarber.firstName} ${targetBarber.lastName}`.trim() : 'el integrante';
    const res = await submitWithConflictHandling({
      barberoId: barberId,
      roles: newRoles,
      sucursalId: targetBarber?.sucursalId ?? sucursalId,
    }, memberName);
    if (!res.ok) {
      if (res.code !== 'MANAGER_REPLACE_REQUIRED' && res.code !== 'STALE_MANAGER_ROLE') {
        toast.error(res.error || 'No se pudo actualizar el cargo');
      }
      return;
    }
    const ok = await verifyRolEquipo(barberId, rolEquipo);
    if (!ok) {
      toast.error('El cambio no quedó persistido. Reintentá.');
      return;
    }
    if (onRefreshBarbers) await onRefreshBarbers();
    await Promise.all([fetchOrgUsers(), fetchUserRoles(), fetchAccessEmails()]);
    toast.success('Cargo actualizado');
  };

  // (legacy duplicate handleChangeRoles removed)

  // Save access_email only (no auth touch)
  const handleSaveAccessEmail = async (barberId: string) => {
    const draft = (emailDrafts[barberId] ?? '').trim();
    setSavingAccess(barberId);
    const res = await callAccessFn({ barberoId: barberId, accessEmail: draft === '' ? null : draft });
    setSavingAccess(null);
    if (!res.ok) { toast.error(res.error || 'No se pudo guardar el email'); return; }
    toast.success('Email de acceso guardado');
    setEmailDrafts(prev => { const c = { ...prev }; delete c[barberId]; return c; });
    await fetchAccessEmails();
  };

  // Generate / regenerate access (creates auth user + temp password)
  const performRegenerate = async (barberId: string) => {
    const linkedUser = getLinkedUser(barberId);
    const draft = emailDrafts[barberId];
    const persisted = accessEmails[barberId];
    const finalEmail = (draft !== undefined ? draft : (persisted ?? '')).trim();
    if (!finalEmail) { toast.error('Cargá un email primero'); return; }

    // Compute current roles from persisted state to send (function will validate)
    const barber = barbers.find(b => b.id === barberId) ?? allBarbers.find(b => b.id === barberId);
    const currentRoles = barber ? getDisplayRoles(barber) : [];
    const rolesToSend = currentRoles.length > 0 ? currentRoles : ['barber' as AppRole];

    setSavingAccess(barberId);
    const memberName = barber ? `${barber.firstName} ${barber.lastName}`.trim() : 'el integrante';
    const res = await submitWithConflictHandling({
      barberoId: barberId,
      accessEmail: draft !== undefined ? (draft === '' ? null : draft) : undefined,
      roles: rolesToSend,
      regenerateAccess: true,
      sucursalId: barber?.sucursalId ?? sucursalId,
    }, memberName);
    setSavingAccess(null);
    if (!res.ok) {
      if (res.code !== 'MANAGER_REPLACE_REQUIRED' && res.code !== 'STALE_MANAGER_ROLE') {
        toast.error(res.error || 'No se pudo generar el acceso');
      }
      return;
    }
    if (res.tempPassword && res.email) {
      setGeneratedCodes(prev => ({ ...prev, [barberId]: { email: res.email!, password: res.tempPassword! } }));
      setEmailDrafts(prev => { const c = { ...prev }; delete c[barberId]; return c; });
      toast.success('Acceso generado');
    }
    await Promise.all([fetchOrgUsers(), fetchUserRoles(), fetchAccessEmails()]);
  };

  // Confirm regenerate countdown
  useEffect(() => {
    if (!confirmRegen) { setRegenCountdown(0); return; }
    if (!confirmRegen.isRegistered) { setRegenCountdown(0); return; }
    setRegenCountdown(5);
    const t = setInterval(() => setRegenCountdown(c => c <= 1 ? 0 : c - 1), 1000);
    return () => clearInterval(t);
  }, [confirmRegen]);

  const resetForm = () => {
    setFormData({ firstName: '', lastName: '', phone: '', commission: '40', address: '', dni: '', roles: ['barber'],
      compensationType: 'comision', fixedSalary: '', payDay: '1' });
  };

  const cancelEdit = () => { setEditingId(null); setIsAdding(false); resetForm(); };

  const handleFormSave = async (data: typeof formData, barberId?: string) => {
    const rolEquipo = rolesToRolEquipo(data.roles);
    if (barberId) {
      const targetBarber = barbers.find(b => b.id === barberId) ?? allBarbers.find(b => b.id === barberId);
      const linkedUser = getLinkedUser(barberId);
      if (linkedUser) {
        const currentRoles = getUserRoles(linkedUser.id);
        if (currentRoles.includes('owner') && rolEquipo !== 'owner') {
          toast.error('No se puede cambiar el cargo del dueño');
          return;
        }
      }

      // Detect whether cargo/sucursal/access actually changed.
      // If only personal fields changed, skip the edge function entirely
      // (avoids triggering manager validation on unrelated edits).
      const currentDisplayRoles = targetBarber ? getDisplayRoles(targetBarber) : [];
      const sortedA = [...currentDisplayRoles].sort().join(',');
      const sortedB = [...data.roles].sort().join(',');
      const rolesChanged = sortedA !== sortedB;
      const newSucursalId = targetBarber?.sucursalId ?? sucursalId;
      const sucursalChanged = (targetBarber?.sucursalId ?? null) !== (newSucursalId ?? null);

      if (rolesChanged || sucursalChanged) {
        const memberName = `${data.firstName} ${data.lastName}`.trim();
        const res = await submitWithConflictHandling({
          barberoId: barberId,
          roles: data.roles,
          sucursalId: newSucursalId,
        }, memberName);
        if (!res.ok) {
          if (res.code !== 'MANAGER_REPLACE_REQUIRED' && res.code !== 'STALE_MANAGER_ROLE') {
            toast.error(res.error || 'No se pudo guardar el cargo');
          }
          return;
        }
        const ok = await verifyRolEquipo(barberId, rolEquipo);
        if (!ok) {
          toast.error('El cambio no quedó persistido. Reintentá.');
          return;
        }
      }

      // Persist personal fields + sync roles locally (idempotent: edge fn already wrote them)
      await onUpdateBarber(barberId, {
        firstName: data.firstName, lastName: data.lastName, phone: data.phone,
        commission: Number(data.commission), address: data.address || undefined, dni: data.dni || undefined,
        compensationType: data.compensationType,
        fixedSalary: data.compensationType === 'fijo' ? Number(data.fixedSalary) || 0 : undefined,
        payDay: data.compensationType === 'fijo' ? Number(data.payDay) || 1 : undefined,
        rolesEquipo: data.roles,
        teamRole: rolEquipo,
      });
      if (onRefreshBarbers) await onRefreshBarbers();
      await Promise.all([fetchOrgUsers(), fetchUserRoles(), fetchAccessEmails()]);
      toast.success('Integrante actualizado');
      setEditingId(null);
    } else {
      const teamRole: TeamRole = rolEquipo;
      const payload = {
        firstName: data.firstName, lastName: data.lastName, phone: data.phone,
        commission: Number(data.commission), address: data.address || undefined, dni: data.dni || undefined, active: true,
        compensationType: data.compensationType,
        fixedSalary: data.compensationType === 'fijo' ? Number(data.fixedSalary) || 0 : undefined,
        payDay: data.compensationType === 'fijo' ? Number(data.payDay) || 1 : undefined,
        teamRole,
        rolesEquipo: data.roles,
      };
      if (isGeneralMode) {
        if (!addPrincipalSucursalId) {
          toast.error('Elegí la sucursal principal antes de guardar.');
          return;
        }
        if (!onAddBarberToSucursal) {
          toast.error('Configuración inválida (general mode sin handler).');
          return;
        }
        onAddBarberToSucursal(payload, addPrincipalSucursalId);
      } else {
        onAddBarber(payload);
      }
      setIsAdding(false);
      setAddPrincipalSucursalId('');
    }
    resetForm();
  };

  const handleConfirmToggle = () => {
    if (!toggleConfirm) return;
    onUpdateBarber(toggleConfirm.barber.id, { active: toggleConfirm.action === 'activate' });
    setToggleConfirm(null);
  };

  // StaffForm is declared at module level (see bottom of file) so its identity
  // remains stable across parent re-renders. This prevents the form from
  // unmounting/remounting (which would reset checkbox state) when the parent
  // re-fetches data while the user is editing.

  // --- Render a barber item ---
  const renderBarberItem = (barber: Barber) => {
    const linkedUser = getLinkedUser(barber.id);
    const linkedRoles = linkedUser ? getUserRoles(linkedUser.id) : [];
    // Visual cargos: siempre desde rolesEquipo (multirol). teamRole es solo rol principal derivado.
    const displayRoles = getDisplayRoles(barber);
    const assignableRoles = displayRoles.filter(r => r !== 'owner');
    const isOwner = displayRoles.includes('owner') || linkedRoles.includes('owner');
    const hasSystemAccess = linkedRoles.some(r => r !== 'otros');

    return (
      <div key={barber.id}>
        {editingId === barber.id ? (
          <StaffForm isEdit={true} barberId={barber.id}
            initialData={{
              firstName: barber.firstName, lastName: barber.lastName, phone: barber.phone,
              commission: String(barber.commission), address: barber.address || '', dni: barber.dni || '',
              roles: displayRoles.length > 0 ? displayRoles : ['barber'],
              compensationType: barber.compensationType || 'comision',
              fixedSalary: barber.fixedSalary != null ? String(barber.fixedSalary) : '',
              payDay: barber.payDay != null ? String(barber.payDay) : '1',
            }}
            onSave={(data) => handleFormSave(data, barber.id)} onCancel={cancelEdit} />
        ) : (
          <div className="p-4 rounded-lg bg-muted/30 hover:bg-muted/50 transition-colors border border-transparent hover:border-border">
            {/* Header: Name + Role + Commission */}
            <div className="mb-3 flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-medium text-foreground">{barber.firstName} {barber.lastName}</span>
                {displayRoles.length > 0 ? (
                  displayRoles.filter(r => isOwner ? true : r !== 'owner').sort((a, b) => ROLE_HIERARCHY[a] - ROLE_HIERARCHY[b]).map(role => (
                    <Badge key={role} variant={getRoleBadgeVariant(role)} className="flex items-center gap-1 text-xs">
                      {getRoleIcon(role)} {getRoleLabel(role)}
                    </Badge>
                  ))
                ) : (
                  <Badge variant="outline" className="text-xs text-muted-foreground">Sin cargo asignado</Badge>
                )}
                {barber.compensationType === 'fijo' ? (
                  <span className="text-xs px-2 py-0.5 rounded bg-accent/50 text-accent-foreground">
                    ${(barber.fixedSalary || 0).toLocaleString('es-AR')}/mes · Día {barber.payDay || 1}
                  </span>
                ) : (
                  <span className="text-xs px-2 py-0.5 rounded bg-primary/10 text-primary">{barber.commission}% comisión</span>
                )}
              </div>
            </div>

            {/* Contact info */}
            <div className="text-xs text-muted-foreground space-y-1 mb-3">
              {linkedUser && (
                <div className="flex items-start gap-1.5">
                  <Mail className="mt-0.5 h-3 w-3 shrink-0" />
                  <span className="break-all">{linkedUser.email}</span>
                </div>
              )}
              {barber.phone && formatPhoneDisplay(barber.phone) && (
                <div className="flex items-start gap-1.5">
                  <span className="flex h-3 w-3 shrink-0 items-center justify-center text-[10px]">Tel</span>
                  <span className="break-words">{formatPhoneDisplay(barber.phone)}</span>
                </div>
              )}
              {barber.address && (
                <div className="flex items-start gap-1.5">
                  <span className="flex h-3 w-3 shrink-0 items-center justify-center text-[10px]">Dir</span>
                  <span className="break-words">{barber.address}</span>
                </div>
              )}
              {barber.dni && (
                <div className="flex items-start gap-1.5">
                  <span className="flex h-3 w-3 shrink-0 items-center justify-center text-[10px]">DNI</span>
                  <span className="break-words">{barber.dni}</span>
                </div>
              )}
            </div>

            {/* Cargos: badges visuales no editables. Edición vía botón Editar. */}
            <div className="flex items-center gap-2 mb-3 flex-wrap">
              <span className="text-xs text-muted-foreground whitespace-nowrap">Cargos:</span>
              {(() => {
                const allRoles: AppRole[] = isOwner
                  ? Array.from(new Set<AppRole>(['owner', ...displayRoles]))
                  : displayRoles;
                return allRoles.map(role => (
                  <Badge key={role} variant={getRoleBadgeVariant(role)} className="flex items-center gap-1 text-xs">
                    {getRoleIcon(role)} {getRoleLabel(role)}
                  </Badge>
                ));
              })()}
            </div>

            {/* Extras de compensación — only for managers/GMs */}
            {(() => {
              const barberRoles = getBarberRoles(barber);
              const isEncargado = barberRoles.includes('manager') || barberRoles.includes('general_manager');
              if (!isEncargado) return null;
              return (
                <ExtrasCompensacion
                  barber={barber}
                  organizationId={organizationId}
                  sucursalId={sucursalId}
                  allBarbers={allBarbers}
                />
              );
            })()}

            {/* Acceso al sistema */}
            {!isOwner && (() => {
              const persistedEmail = accessEmails[barber.id] ?? null;
              const draft = emailDrafts[barber.id];
              const currentValue = draft !== undefined ? draft : (persistedEmail ?? '');
              const isRegistered = !!linkedUser;
              const hasPersistedEmail = !!persistedEmail;
              const isDirty = draft !== undefined && draft !== (persistedEmail ?? '');
              const code = generatedCodes[barber.id];
              const saving = savingAccess === barber.id;

              let stateLabel = 'Sin email de acceso';
              let stateClass = 'text-muted-foreground';
              if (isRegistered) { stateLabel = 'Usuario registrado'; stateClass = 'text-success'; }
              else if (hasPersistedEmail) { stateLabel = 'Email cargado — acceso pendiente'; stateClass = 'text-primary'; }

              return (
                <div className="mt-3 mb-3 p-3 rounded-md bg-background/60 border border-border space-y-2">
                  <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
                    <span className="text-xs font-medium text-foreground flex items-center gap-1.5">
                      <KeyRound className="h-3.5 w-3.5" /> Acceso al sistema
                    </span>
                    <span className={`text-[11px] ${stateClass}`}>{stateLabel}</span>
                  </div>
                  <div className="flex flex-col sm:flex-row gap-2">
                    <Input
                      type="email"
                      placeholder="email@ejemplo.com"
                      value={currentValue}
                      maxLength={80}
                      onChange={(e) => setEmailDrafts(prev => ({ ...prev, [barber.id]: e.target.value }))}
                      className="h-8 text-xs flex-1"
                      autoComplete="off"
                    />
                    <div className="flex flex-col gap-2 sm:flex-row">
                      <Button size="sm" variant="outline" className="h-8 w-full text-xs sm:w-auto"
                        disabled={saving || !isDirty}
                        onClick={() => handleSaveAccessEmail(barber.id)}>
                        Guardar email
                      </Button>
                      <Button size="sm" className="h-8 w-full text-xs sm:w-auto"
                        disabled={saving || (!hasPersistedEmail && !(draft && draft.trim()))}
                        onClick={() => {
                          const email = (draft !== undefined ? draft : persistedEmail) || '';
                          setConfirmRegen({ barberId: barber.id, email: email.trim(), isRegistered });
                        }}>
                        {isRegistered ? 'Regenerar acceso' : 'Generar acceso'}
                      </Button>
                    </div>
                  </div>
                  {code && (
                    <div className="mt-2 p-2 rounded bg-primary/10 border border-primary/30 space-y-1">
                      <p className="text-[11px] text-muted-foreground">Mostrá este código una sola vez. No quedará guardado.</p>
                      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                        <div className="text-xs">
                          <div><span className="text-muted-foreground">Email:</span> <span className="font-mono">{code.email}</span></div>
                          <div><span className="text-muted-foreground">Contraseña temporal:</span> <span className="font-mono font-semibold">{code.password}</span></div>
                        </div>
                        <div className="flex self-end gap-1 sm:self-auto">
                          <Button size="sm" variant="ghost" className="h-7 px-2"
                            onClick={() => { navigator.clipboard.writeText(`${code.email} / ${code.password}`); toast.success('Copiado'); }}>
                            <Copy className="h-3.5 w-3.5" />
                          </Button>
                          <Button size="sm" variant="ghost" className="h-7 px-2"
                            onClick={() => setGeneratedCodes(prev => { const c = { ...prev }; delete c[barber.id]; return c; })}>
                            <X className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              );
            })()}


            <div className="flex flex-wrap gap-2 pt-2 border-t border-border">
              <Button variant="ghost" size="sm" className="h-8 text-xs" onClick={() => {
                setEditingId(barber.id);
                setFormData({
                  firstName: barber.firstName, lastName: barber.lastName, phone: barber.phone,
                  commission: String(barber.commission), address: barber.address || '', dni: barber.dni || '',
                  roles: displayRoles.length > 0 ? displayRoles : ['barber'],
                  compensationType: barber.compensationType || 'comision',
                  fixedSalary: barber.fixedSalary != null ? String(barber.fixedSalary) : '',
                  payDay: barber.payDay != null ? String(barber.payDay) : '1',
                });
              }}>
                <Edit2 className="h-3.5 w-3.5 mr-1" /> Editar
              </Button>

              {linkedUser && hasSystemAccess && (
                <Button variant="ghost" size="sm" className={`h-8 text-xs ${barberPinStatus[barber.id] ? 'text-primary' : ''}`}
                  onClick={() => setPinDialogBarber(barber)}>
                  <Lock className="h-3.5 w-3.5 mr-1" /> {barberPinStatus[barber.id] ? 'Editar PIN' : 'Configurar PIN'}
                </Button>
              )}


              <Button variant="ghost" size="sm" className="h-8 text-xs"
                onClick={() => setToggleConfirm({
                  barber,
                  action: barber.active ? 'deactivate' : 'activate',
                })}>
                {barber.active ? (
                  <><UserX className="h-3.5 w-3.5 mr-1 text-destructive" /> <span className="text-destructive">Desactivar</span></>
                ) : (
                  <><UserCheck className="h-3.5 w-3.5 mr-1 text-success" /> <span className="text-success">Activar</span></>
                )}
              </Button>
            </div>
          </div>
        )}
      </div>
    );
  };

  const sortedActive = sortByHierarchy(activeBarbers);
  const sortedInactive = sortByHierarchy(inactiveBarbers);

  return (
    <>
      <Card className="border border-border bg-card">
        <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <CardTitle className="text-base font-medium">Equipo</CardTitle>
          {!isAdding && !editingId && activeSubTab === 'active' && (
            <Button variant="outline" size="sm" className="w-full sm:w-auto" onClick={() => setIsAdding(true)}>
              <Plus className="h-4 w-4 mr-1" /> Agregar
            </Button>
          )}
        </CardHeader>
        <CardContent className="space-y-4">
          <Tabs value={activeSubTab} onValueChange={(v) => setActiveSubTab(v as 'active' | 'inactive')}>
            <TabsList className="grid h-auto w-full grid-cols-2 gap-1 rounded-md bg-muted/50 p-1">
              <TabsTrigger value="active" className="min-h-8 whitespace-normal px-2 text-xs data-[state=active]:bg-card">Activos ({activeBarbers.length})</TabsTrigger>
              <TabsTrigger value="inactive" className="min-h-8 whitespace-normal px-2 text-xs data-[state=active]:bg-card">Inactivos ({inactiveBarbers.length})</TabsTrigger>
            </TabsList>
            <TabsContent value="active" className="mt-4 space-y-3">
              {isAdding && (
                <div className="space-y-3">
                  {isGeneralMode && (
                    <div className="p-3 rounded-md border border-border bg-muted/30 space-y-2">
                      <label className="text-xs font-medium text-foreground">Sucursal principal</label>
                      <Select value={addPrincipalSucursalId} onValueChange={setAddPrincipalSucursalId}>
                        <SelectTrigger className="h-9 text-sm">
                          <SelectValue placeholder="Elegí la sucursal principal" />
                        </SelectTrigger>
                        <SelectContent>
                          {sucursalesForSection.map(s => (
                            <SelectItem key={s.id} value={s.id}>{s.nombre}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <p className="text-[11px] text-muted-foreground">
                        Esta sucursal queda como base del barbero. Podés agregar sucursales secundarias después.
                      </p>
                    </div>
                  )}
                  <StaffForm isEdit={false} initialData={formData} onSave={(data) => handleFormSave(data)} onCancel={cancelEdit} />
                </div>
              )}
              {sortedActive.map(renderBarberItem)}
              {sortedActive.length === 0 && !isAdding && (
                <p className="text-sm text-muted-foreground text-center py-4">No hay miembros activos</p>
              )}
            </TabsContent>
            <TabsContent value="inactive" className="mt-4 space-y-3">
              {sortedInactive.map(renderBarberItem)}
              {sortedInactive.length === 0 && (
                <p className="text-sm text-muted-foreground text-center py-4">No hay miembros inactivos</p>
              )}
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>

      {/* Dialogs */}
      <InviteUserDialog open={!!inviteBarber} onOpenChange={(open) => !open && setInviteBarber(null)} barber={inviteBarber || undefined} sucursales={sucursales as any} />
      <StaffPinDialog open={!!pinDialogBarber} onOpenChange={(open) => !open && setPinDialogBarber(null)}
        barberId={pinDialogBarber?.id || ''} barberName={pinDialogBarber ? `${pinDialogBarber.firstName} ${pinDialogBarber.lastName}` : ''}
        hasPin={pinDialogBarber ? !!barberPinStatus[pinDialogBarber.id] : false} onPinUpdated={fetchPinStatus} />

      {/* Confirmation dialog for activate/deactivate */}
      {/* Confirm regenerate access */}
      <AlertDialog open={!!confirmRegen} onOpenChange={(open) => !open && setConfirmRegen(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              {confirmRegen?.isRegistered && <AlertTriangle className="h-4 w-4 text-amber-500" />}
              {confirmRegen?.isRegistered ? 'Regenerar acceso' : 'Generar acceso'}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {confirmRegen?.isRegistered
                ? `Esta acción reemplazará la contraseña actual del usuario (${confirmRegen?.email}). El acceso anterior dejará de funcionar inmediatamente. Se generará una contraseña temporal que verás una sola vez.`
                : `Se creará un acceso para ${confirmRegen?.email} con una contraseña temporal. La verás una sola vez.`}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              disabled={confirmRegen?.isRegistered && regenCountdown > 0}
              onClick={async () => {
                const target = confirmRegen;
                setConfirmRegen(null);
                if (target) await performRegenerate(target.barberId);
              }}>
              {confirmRegen?.isRegistered && regenCountdown > 0 ? `Confirmar (${regenCountdown}s)` : 'Confirmar'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={!!toggleConfirm} onOpenChange={(open) => !open && setToggleConfirm(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {toggleConfirm?.action === 'deactivate' ? 'Desactivar miembro' : 'Activar miembro'}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {toggleConfirm?.action === 'deactivate'
                ? `¿Estás seguro de que querés desactivar a ${toggleConfirm?.barber.firstName} ${toggleConfirm?.barber.lastName}? No aparecerá en el listado activo.`
                : `¿Querés volver a activar a ${toggleConfirm?.barber.firstName} ${toggleConfirm?.barber.lastName}?`}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleConfirmToggle}>
              {toggleConfirm?.action === 'deactivate' ? 'Desactivar' : 'Activar'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Manager replacement confirmation */}
      <AlertDialog open={!!replaceMgrDialog} onOpenChange={(open) => {
        if (!open && replaceMgrDialog && !resolvingReplaceDialogRef.current) {
          replaceMgrDialog.onResolved({ ok: false, code: 'CANCELLED' });
          setReplaceMgrDialog(null);
        }
      }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-amber-500" />
              Reemplazar Encargado de Sucursal
            </AlertDialogTitle>
            <AlertDialogDescription>
              {replaceMgrDialog && (
                <>
                  Estás a punto de cambiar el rango de <strong>{replaceMgrDialog.newMemberName}</strong>.
                  Este rango actualmente pertenece a <strong>{replaceMgrDialog.currentManagerName}</strong>.
                  Si confirmás el cambio, {replaceMgrDialog.currentManagerName} dejará de ser Encargado de Sucursal.
                </>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={async () => {
              const target = replaceMgrDialog;
              if (!target) return;
              resolvingReplaceDialogRef.current = true;
              try {
                const retryRes = await callAccessFn({
                  ...target.payload,
                  replaceExistingManager: true,
                  existingManagerBarberoId: target.currentManagerBarberoId,
                });
                if (retryRes.ok) {
                  if (onRefreshBarbers) await onRefreshBarbers();
                  await Promise.all([fetchOrgUsers(), fetchUserRoles(), fetchAccessEmails()]);
                  toast.success('Encargado reemplazado');
                } else {
                  toast.error(retryRes.error || 'No se pudo reemplazar al Encargado');
                }
                target.onResolved(retryRes);
              } finally {
                setReplaceMgrDialog(null);
                resolvingReplaceDialogRef.current = false;
              }
            }}>
              Confirmar reemplazo
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Stale manager role inconsistency */}
      <AlertDialog open={!!staleMgrDialog} onOpenChange={(open) => {
        if (!open && staleMgrDialog && !resolvingStaleDialogRef.current) {
          staleMgrDialog.onResolved({ ok: false, code: 'CANCELLED' });
          setStaleMgrDialog(null);
        }
      }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-amber-500" />
              Inconsistencia detectada
            </AlertDialogTitle>
            <AlertDialogDescription>
              {staleMgrDialog && (
                <>
                  Detectamos una inconsistencia: <strong>{staleMgrDialog.conflictName || staleMgrDialog.conflictEmail || 'un usuario'}</strong> figura
                  como Encargado en permisos reales, pero no aparece como Encargado en el equipo.
                  Para continuar, Vittro debe corregir esa sincronización.
                </>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={async () => {
              const target = staleMgrDialog;
              if (!target) return;
              resolvingStaleDialogRef.current = true;
              try {
                const retryRes = await callAccessFn({
                  ...target.payload,
                  resolveStaleManagerConflict: true,
                });
                if (retryRes.ok) {
                  if (onRefreshBarbers) await onRefreshBarbers();
                  await Promise.all([fetchOrgUsers(), fetchUserRoles(), fetchAccessEmails()]);
                  toast.success('Inconsistencia corregida');
                } else {
                  toast.error(retryRes.error || 'No se pudo corregir la inconsistencia');
                }
                target.onResolved(retryRes);
              } finally {
                setStaleMgrDialog(null);
                resolvingStaleDialogRef.current = false;
              }
            }}>
              Corregir y continuar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

// --- Staff Form (module-level so identity is stable across parent re-renders) ---
interface StaffFormProps {
  isEdit: boolean;
  barberId?: string;
  initialData: StaffFormData;
  onSave: (data: StaffFormData) => void;
  onCancel: () => void;
}

const StaffForm = React.memo(function StaffForm({ isEdit, barberId, initialData, onSave, onCancel }: StaffFormProps) {
  const [localData, setLocalData] = useState<StaffFormData>(initialData);
  const [localCommissionError, setLocalCommissionError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [phoneOut, setPhoneOut] = useState<PhoneInputChange | null>(null);
  const submittingRef = useRef(false);
  const phoneHasInvalidContent = !!phoneOut && !phoneOut.isValid && phoneOut.reason !== 'empty';


  // Reset only when switching to a different barber (or entering/leaving add mode).
  // Do NOT reset on every initialData reference change — the parent may re-render
  // and produce a new object while the user is editing.
  useEffect(() => {
    setLocalData(initialData);
    setLocalCommissionError('');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [barberId]);

  const isComision = localData.compensationType === 'comision';
  const commissionRequired = isComision && localData.roles.includes('barber');

  const validateLocalCommission = (value: string): boolean => {
    if (!commissionRequired && (value === '' || value === '0')) {
      setLocalCommissionError(''); return true;
    }
    const num = Number(value);
    if (value === '' || isNaN(num)) { setLocalCommissionError('Ingresa un número válido'); return false; }
    if (num < 0 || num > 100) { setLocalCommissionError('Debe estar entre 0 y 100'); return false; }
    setLocalCommissionError(''); return true;
  };

  const handleSubmit = async () => {
    if (submittingRef.current) return;
    if (!localData.firstName || !localData.lastName) return;
    if (phoneHasInvalidContent) return;
    if (isComision && commissionRequired && !localData.commission) return;
    if (isComision && !validateLocalCommission(localData.commission)) return;
    if (!isComision && !localData.fixedSalary) return;
    submittingRef.current = true;
    setIsSubmitting(true);
    try {
      await Promise.resolve(onSave(localData));
    } finally {
      submittingRef.current = false;
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-3 p-4 bg-muted/30 border border-border rounded-lg animate-scale-in">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <Input placeholder="Nombre *" value={localData.firstName} onChange={(e) => setLocalData(prev => ({ ...prev, firstName: e.target.value }))} autoComplete="off" />
        <Input placeholder="Apellido *" value={localData.lastName} onChange={(e) => setLocalData(prev => ({ ...prev, lastName: e.target.value }))} autoComplete="off" />
      </div>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <PhoneInput
          value={localData.phone || null}
          onChange={(o) => {
            setLocalData(prev => ({ ...prev, phone: o.e164 ?? '' }));
            setPhoneOut(o);
          }}
          defaultCountry="AR"
          allowedCountries={['AR', 'UY', 'CL', 'CO', 'MX', 'ES', 'BR']}
        />
        <Input placeholder="DNI (opcional)" value={localData.dni} onChange={(e) => setLocalData(prev => ({ ...prev, dni: e.target.value }))} autoComplete="off" />
      </div>
      <div className="grid grid-cols-1 gap-3">
        <Input placeholder="Dirección (opcional)" value={localData.address} onChange={(e) => setLocalData(prev => ({ ...prev, address: e.target.value }))} autoComplete="off" name="staff-address-field" />
      </div>
      <div className="space-y-1.5">
        <label className="text-xs font-medium text-muted-foreground">Tipo de compensación *</label>
        <Select value={localData.compensationType} onValueChange={(v) => setLocalData(prev => ({ ...prev, compensationType: v as CompensationType }))}>
          <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="comision">Por comisión (%)</SelectItem>
            <SelectItem value="fijo">Sueldo fijo mensual ($)</SelectItem>
          </SelectContent>
        </Select>
      </div>
      {isComision ? (
        <div className="space-y-1.5">
          <label className="text-xs font-medium text-muted-foreground">{commissionRequired ? 'Comisión % *' : 'Comisión % (opcional)'}</label>
          <Input type="text" inputMode="numeric" placeholder="Ej: 40" value={localData.commission}
            onChange={(e) => { setLocalData(prev => ({ ...prev, commission: e.target.value })); if (e.target.value) validateLocalCommission(e.target.value); }}
            onBlur={() => validateLocalCommission(localData.commission)}
            className={localCommissionError ? 'border-destructive' : ''} autoComplete="off" />
          {localCommissionError && <p className="text-xs text-destructive mt-1">{localCommissionError}</p>}
        </div>
      ) : (
        <div className="space-y-3">
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground">Sueldo fijo mensual *</label>
            <CurrencyInput placeholder="Ej: 350.000" value={localData.fixedSalary}
              onChange={(v) => setLocalData(prev => ({ ...prev, fixedSalary: v }))} />
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground">Día de cobro (1-28) *</label>
            <Input type="number" inputMode="numeric" placeholder="1" min={1} max={28} value={localData.payDay}
              onChange={(e) => {
                const val = Math.min(28, Math.max(1, Number(e.target.value) || 1));
                setLocalData(prev => ({ ...prev, payDay: String(val) }));
              }} autoComplete="off" />
          </div>
        </div>
      )}
      {(() => {
        const isOwnerLocal = localData.roles.includes('owner');
        const hier = getHierarchicalRole(localData.roles);
        const gmSelected = hier === 'general_manager';
        const mgrSelected = hier === 'manager';
        const barberSelected = hasOperationalBarber(localData.roles);

        return (
          <div className="space-y-4">
            {isOwnerLocal && (
              <div className="flex items-start gap-2 p-3 rounded-md border border-border bg-muted/40">
                <Shield className="h-4 w-4 mt-0.5 text-muted-foreground" />
                <div className="text-xs text-muted-foreground">
                  Este integrante es <span className="font-medium text-foreground">Dueño del negocio</span>. Este cargo no se puede modificar desde Equipo.
                </div>
              </div>
            )}

            <div className="space-y-2">
              <div>
                <div className="text-sm font-medium text-foreground">Cargo jerárquico</div>
                <div className="text-xs text-muted-foreground">Define responsabilidades de gestión dentro del negocio.</div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <RoleCard
                  icon={<Shield className="h-4 w-4" />}
                  title="Encargado General"
                  description="Acceso amplio a gestión y configuración."
                  selected={gmSelected}
                  state={isOwnerLocal ? 'disabled' : (mgrSelected ? 'replaceable' : 'normal')}
                  auxiliaryLabel={isOwnerLocal ? 'No disponible para dueños.' : (mgrSelected ? 'Reemplaza Encargado de Sucursal.' : undefined)}
                  onClick={isOwnerLocal ? undefined : () => setLocalData(prev => ({ ...prev, roles: toggleHierarchical(prev.roles, 'general_manager') }))}
                />
                <RoleCard
                  icon={<UserCheck className="h-4 w-4" />}
                  title="Encargado de Sucursal"
                  description="Gestiona la operación de esta sucursal."
                  selected={mgrSelected}
                  state={isOwnerLocal ? 'disabled' : (gmSelected ? 'replaceable' : 'normal')}
                  auxiliaryLabel={isOwnerLocal ? 'No disponible para dueños.' : (gmSelected ? 'Reemplaza Encargado General.' : undefined)}
                  onClick={isOwnerLocal ? undefined : () => setLocalData(prev => ({ ...prev, roles: toggleHierarchical(prev.roles, 'manager') }))}
                />
              </div>
            </div>

            <div className="space-y-2">
              <div>
                <div className="text-sm font-medium text-foreground">Trabajo operativo</div>
                <div className="text-xs text-muted-foreground">Indica si esta persona también trabaja realizando servicios.</div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <RoleCard
                  icon={<Scissors className="h-4 w-4" />}
                  title="Barbero"
                  description="Puede recibir turnos, ventas y comisiones."
                  selected={barberSelected}
                  onClick={() => setLocalData(prev => ({ ...prev, roles: toggleBarber(prev.roles) }))}
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <div className="text-xs text-muted-foreground">Este integrante quedará como:</div>
              <div className="flex items-center gap-1.5 flex-wrap">
                {localData.roles.map((role, idx) => (
                  <React.Fragment key={role}>
                    {idx > 0 && <span className="text-xs text-muted-foreground">+</span>}
                    <Badge variant={getRoleBadgeVariant(role)} className="flex items-center gap-1 text-xs">
                      {getRoleIcon(role)} {getRoleLabel(role)}
                    </Badge>
                  </React.Fragment>
                ))}
              </div>
            </div>
          </div>
        );
      })()}
      <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
        <Button variant="ghost" size="sm" className="w-full sm:w-auto" onClick={onCancel} disabled={isSubmitting}><X className="h-4 w-4 mr-1" /> Cancelar</Button>
        <Button size="sm" onClick={handleSubmit} className="w-full bg-success hover:bg-success/90 sm:w-auto"
          disabled={isSubmitting || !localData.firstName || !localData.lastName || phoneHasInvalidContent || (isComision && commissionRequired && !localData.commission) || (!isComision && !localData.fixedSalary) || !!localCommissionError}>
          <Save className="h-4 w-4 mr-1" /> {isSubmitting ? 'Guardando…' : (isEdit ? 'Guardar' : 'Agregar')}
        </Button>
      </div>
    </div>
  );
});
