import React, { useState, useEffect, useCallback } from 'react';
import { Plus, Edit2, Save, X, Lock, Mail, UserX, UserCheck, Shield, Scissors, ChevronDown, Users, KeyRound, Copy, AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { CurrencyInput } from '@/components/ui/currency-input';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Barber, CompensationType, TeamRole, getBarberDisplayName } from '@/types/barbershop';
import { AppRole } from '@/contexts/AuthContext';
import { InviteUserDialog } from '@/components/InviteUserDialog';
import { ExtrasCompensacion } from './ExtrasCompensacion';
import { StaffPinDialog } from '@/components/StaffPinDialog';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

// --- Role utilities ---
const ROLE_HIERARCHY: Record<AppRole, number> = {
  owner: 0,
  general_manager: 1,
  manager: 2,
  barber: 3,
  otros: 4,
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
  onUpdateBarber: (id: string, updates: Partial<Barber>) => void;
}

interface ToggleConfirm {
  barber: Barber;
  action: 'activate' | 'deactivate';
}

export function EquipoUnificado({
  sucursalId, organizationId, barbers, allBarbers, sucursales = [], onAddBarber, onUpdateBarber,
}: EquipoUnificadoProps) {
  const [isAdding, setIsAdding] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [activeSubTab, setActiveSubTab] = useState<'active' | 'inactive'>('active');
  const [inviteBarber, setInviteBarber] = useState<Barber | null>(null);
  const [pinDialogBarber, setPinDialogBarber] = useState<Barber | null>(null);
  const [barberPinStatus, setBarberPinStatus] = useState<Record<string, boolean>>({});
  const [toggleConfirm, setToggleConfirm] = useState<ToggleConfirm | null>(null);

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

  const activeBarbers = barbers.filter(b => b.active);
  const inactiveBarbers = barbers.filter(b => !b.active);

  // Fetch PIN status
  const fetchPinStatus = useCallback(async () => {
    if (barbers.length === 0) return;
    try {
      const { data, error } = await supabase.from('barberos').select('id, pin_hash').in('id', barbers.map(b => b.id));
      if (error) throw error;
      const status: Record<string, boolean> = {};
      data?.forEach(b => { status[b.id] = !!b.pin_hash; });
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

  // Get the highest role for a barber (for sorting)
  const getBarberHighestRole = (barber: Barber): AppRole | null => {
    const roles = getBarberRoles(barber);
    if (roles.length === 0) return null;
    return roles.sort((a, b) => ROLE_HIERARCHY[a] - ROLE_HIERARCHY[b])[0];
  };

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
  const rolesToRolEquipo = (roles: AppRole[]): TeamRole | 'manager' | 'general_manager' | 'owner' => {
    if (roles.includes('owner')) return 'owner' as any;
    if (roles.includes('general_manager')) return 'general_manager' as any;
    if (roles.includes('manager')) return 'manager' as any;
    if (roles.includes('barber')) return 'barbero';
    return 'otros';
  };

  // Centralized call to edge function
  const callAccessFn = async (payload: {
    barberoId: string;
    accessEmail?: string | null;
    rolEquipo?: any;
    regenerateAccess?: boolean;
  }): Promise<{ ok: boolean; tempPassword?: string | null; email?: string | null; error?: string }> => {
    try {
      const { data, error } = await supabase.functions.invoke('update-team-member-access', {
        body: {
          barberoId: payload.barberoId,
          organizationId,
          sucursalId,
          accessEmail: payload.accessEmail,
          rolEquipo: payload.rolEquipo,
          regenerateAccess: payload.regenerateAccess ?? false,
        },
      });
      if (error) return { ok: false, error: (error as any).message || 'Error en la solicitud' };
      if ((data as any)?.error) return { ok: false, error: (data as any).error };
      return { ok: true, tempPassword: (data as any)?.tempPassword, email: (data as any)?.email };
    } catch (e: any) {
      return { ok: false, error: e?.message || 'Error en la solicitud' };
    }
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
      if (currentRoles.includes('owner')) {
        toast.error('No se puede cambiar el cargo del dueño');
        return;
      }
    }
    const rolEquipo = rolesToRolEquipo(newRoles);
    const res = await callAccessFn({ barberoId: barberId, rolEquipo });
    if (!res.ok) {
      toast.error(res.error || 'No se pudo actualizar el cargo');
      return;
    }
    toast.success('Cargo actualizado');
    onUpdateBarber(barberId, { teamRole: (newRoles.includes('barber') ? 'barbero' : 'otros') as TeamRole });
    await Promise.all([fetchOrgUsers(), fetchUserRoles(), fetchAccessEmails()]);
  };

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

    // Compute current rolEquipo from persisted state to send (function will validate)
    const barber = barbers.find(b => b.id === barberId);
    const currentRoles = linkedUser ? getUserRoles(linkedUser.id) : [];
    let rolEquipo: any = barber?.teamRole ?? 'barbero';
    if (currentRoles.includes('owner')) rolEquipo = 'owner';
    else if (currentRoles.includes('general_manager')) rolEquipo = 'general_manager';
    else if (currentRoles.includes('manager')) rolEquipo = 'manager';
    else if (currentRoles.includes('barber')) rolEquipo = 'barbero';

    setSavingAccess(barberId);
    const res = await callAccessFn({
      barberoId: barberId,
      accessEmail: draft !== undefined ? (draft === '' ? null : draft) : undefined,
      rolEquipo,
      regenerateAccess: true,
    });
    setSavingAccess(null);
    if (!res.ok) { toast.error(res.error || 'No se pudo generar el acceso'); return; }
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
    const teamRole: TeamRole = data.roles.includes('barber') ? 'barbero' : 'otros';
    if (barberId) {
      onUpdateBarber(barberId, {
        firstName: data.firstName, lastName: data.lastName, phone: data.phone,
        commission: Number(data.commission), address: data.address || undefined, dni: data.dni || undefined,
        compensationType: data.compensationType,
        fixedSalary: data.compensationType === 'fijo' ? Number(data.fixedSalary) || 0 : undefined,
        payDay: data.compensationType === 'fijo' ? Number(data.payDay) || 1 : undefined,
        teamRole,
      });
      // Update roles if linked user exists
      const linkedUser = getLinkedUser(barberId);
      if (linkedUser) {
        await handleChangeRoles(barberId, data.roles);
      }
      setEditingId(null);
    } else {
      onAddBarber({
        firstName: data.firstName, lastName: data.lastName, phone: data.phone,
        commission: Number(data.commission), address: data.address || undefined, dni: data.dni || undefined, active: true,
        compensationType: data.compensationType,
        fixedSalary: data.compensationType === 'fijo' ? Number(data.fixedSalary) || 0 : undefined,
        payDay: data.compensationType === 'fijo' ? Number(data.payDay) || 1 : undefined,
        teamRole,
      });
      setIsAdding(false);
    }
    resetForm();
  };

  const handleConfirmToggle = () => {
    if (!toggleConfirm) return;
    onUpdateBarber(toggleConfirm.barber.id, { active: toggleConfirm.action === 'activate' });
    setToggleConfirm(null);
  };

  // --- Staff Form ---
  const StaffForm = React.memo(({ isEdit, barberId, initialData, onSave, onCancel }: {
    isEdit: boolean; barberId?: string;
    initialData: typeof formData;
    onSave: (data: typeof formData) => void;
    onCancel: () => void;
  }) => {
    const [localData, setLocalData] = useState(initialData);
    const [localCommissionError, setLocalCommissionError] = useState('');

    const isComision = localData.compensationType === 'comision';
    const commissionRequired = isComision && (localData.roles.includes('barber') || localData.roles.includes('manager'));

    const validateLocalCommission = (value: string): boolean => {
      if (!commissionRequired && (value === '' || value === '0')) {
        setLocalCommissionError(''); return true;
      }
      const num = Number(value);
      if (value === '' || isNaN(num)) { setLocalCommissionError('Ingresa un número válido'); return false; }
      if (num < 0 || num > 100) { setLocalCommissionError('Debe estar entre 0 y 100'); return false; }
      setLocalCommissionError(''); return true;
    };

    const handleSubmit = () => {
      if (!localData.firstName || !localData.lastName || !localData.phone) return;
      if (isComision && commissionRequired && !localData.commission) return;
      if (isComision && !validateLocalCommission(localData.commission)) return;
      if (!isComision && !localData.fixedSalary) return;
      onSave(localData);
    };

    return (
      <div className="space-y-3 p-4 bg-muted/30 border border-border rounded-lg animate-scale-in">
        <div className="grid grid-cols-2 gap-3">
          <Input placeholder="Nombre *" value={localData.firstName} onChange={(e) => setLocalData(prev => ({ ...prev, firstName: e.target.value }))} autoComplete="off" />
          <Input placeholder="Apellido *" value={localData.lastName} onChange={(e) => setLocalData(prev => ({ ...prev, lastName: e.target.value }))} autoComplete="off" />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Input placeholder="Teléfono *" value={localData.phone} onChange={(e) => setLocalData(prev => ({ ...prev, phone: e.target.value }))} autoComplete="off" />
          <Input placeholder="DNI (opcional)" value={localData.dni} onChange={(e) => setLocalData(prev => ({ ...prev, dni: e.target.value }))} autoComplete="off" />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Input placeholder="Dirección (opcional)" value={localData.address} onChange={(e) => setLocalData(prev => ({ ...prev, address: e.target.value }))} autoComplete="off" name="staff-address-field" />
        </div>
        {/* Compensation type selector */}
        <div className="space-y-1.5">
          <label className="text-xs font-medium text-muted-foreground">Tipo de compensación *</label>
          <Select value={localData.compensationType} onValueChange={(v) => setLocalData(prev => ({ ...prev, compensationType: v as CompensationType }))}>
            <SelectTrigger className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="comision">Por comisión (%)</SelectItem>
              <SelectItem value="fijo">Sueldo fijo mensual ($)</SelectItem>
            </SelectContent>
          </Select>
        </div>
        {/* Commission or Fixed Salary */}
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
        {/* Role selector — multi-select with checkboxes */}
        <div className="space-y-1.5">
          <label className="text-xs font-medium text-muted-foreground">Cargo(s) *</label>
          <div className="space-y-2 p-3 border border-border rounded-md">
            {ASSIGNABLE_ROLES.map(role => (
              <label key={role} className="flex items-center gap-2 cursor-pointer">
                <Checkbox
                  checked={localData.roles.includes(role)}
                  onCheckedChange={(checked) => {
                    setLocalData(prev => {
                      const newRoles = checked
                        ? [...prev.roles, role]
                        : prev.roles.filter(r => r !== role);
                      return { ...prev, roles: newRoles.length > 0 ? newRoles : prev.roles };
                    });
                  }}
                />
                <span className="flex items-center gap-1.5 text-sm">
                  {getRoleIcon(role)} {getRoleLabel(role)}
                </span>
              </label>
            ))}
          </div>
        </div>
        <div className="flex justify-end gap-2">
          <Button variant="ghost" size="sm" onClick={onCancel}><X className="h-4 w-4 mr-1" /> Cancelar</Button>
          <Button size="sm" onClick={handleSubmit} className="bg-success hover:bg-success/90"
            disabled={!localData.firstName || !localData.lastName || !localData.phone || localData.roles.length === 0 || (isComision && commissionRequired && !localData.commission) || (!isComision && !localData.fixedSalary) || !!localCommissionError}>
            <Save className="h-4 w-4 mr-1" /> {isEdit ? 'Guardar' : 'Agregar'}
          </Button>
        </div>
      </div>
    );
  });

  // --- Render a barber item ---
  const renderBarberItem = (barber: Barber) => {
    const linkedUser = getLinkedUser(barber.id);
    const roles = linkedUser ? getUserRoles(linkedUser.id) : [];
    const assignableRoles = roles.filter(r => r !== 'owner');
    const isOwner = roles.includes('owner');
    const hasSystemAccess = roles.some(r => r !== 'otros');

    return (
      <div key={barber.id}>
        {editingId === barber.id ? (
          <StaffForm isEdit={true} barberId={barber.id}
            initialData={{
              firstName: barber.firstName, lastName: barber.lastName, phone: barber.phone,
              commission: String(barber.commission), address: barber.address || '', dni: barber.dni || '',
              roles: assignableRoles.length > 0 ? assignableRoles : ['barber'],
              compensationType: barber.compensationType || 'comision',
              fixedSalary: barber.fixedSalary != null ? String(barber.fixedSalary) : '',
              payDay: barber.payDay != null ? String(barber.payDay) : '1',
            }}
            onSave={(data) => handleFormSave(data, barber.id)} onCancel={cancelEdit} />
        ) : (
          <div className="p-4 rounded-lg bg-muted/30 hover:bg-muted/50 transition-colors border border-transparent hover:border-border">
            {/* Header: Name + Role + Commission */}
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-medium text-foreground">{barber.firstName} {barber.lastName}</span>
                {roles.filter(r => r !== 'owner' || isOwner).length > 0 ? (
                  roles.filter(r => isOwner ? true : r !== 'owner').sort((a, b) => ROLE_HIERARCHY[a] - ROLE_HIERARCHY[b]).map(role => (
                    <Badge key={role} variant={getRoleBadgeVariant(role)} className="flex items-center gap-1 text-xs">
                      {getRoleIcon(role)} {getRoleLabel(role)}
                    </Badge>
                  ))
                ) : !linkedUser ? (
                  <Badge variant="outline" className="text-xs text-muted-foreground">Sin cargo — Invitalo para asignar</Badge>
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
                <div className="flex items-center gap-1.5">
                  <Mail className="w-3 h-3" />
                  <span>{linkedUser.email}</span>
                </div>
              )}
              <div className="flex items-center gap-1.5">
                <span className="w-3 h-3 flex items-center justify-center text-[10px]">Tel</span>
                <span>{barber.phone}</span>
              </div>
              {barber.address && (
                <div className="flex items-center gap-1.5">
                  <span className="w-3 h-3 flex items-center justify-center text-[10px]">Dir</span>
                  <span>{barber.address}</span>
                </div>
              )}
              {barber.dni && (
                <div className="flex items-center gap-1.5">
                  <span className="w-3 h-3 flex items-center justify-center text-[10px]">DNI</span>
                  <span>{barber.dni}</span>
                </div>
              )}
            </div>

            {/* Role multi-select (only for non-owners with linked users) */}
            {linkedUser && !isOwner && (
              <div className="flex items-center gap-2 mb-3 flex-wrap">
                <span className="text-xs text-muted-foreground whitespace-nowrap">Cargos:</span>
                {ASSIGNABLE_ROLES.map(role => (
                  <label key={role} className="flex items-center gap-1 cursor-pointer">
                    <Checkbox
                      className="h-3.5 w-3.5"
                      checked={(assignableRoles as string[]).includes(role)}
                      onCheckedChange={(checked) => {
                        const newRoles = checked
                          ? [...assignableRoles, role]
                          : assignableRoles.filter(r => r !== role);
                        if (newRoles.length > 0) {
                          handleChangeRoles(barber.id, newRoles);
                        }
                      }}
                    />
                    <span className="text-xs">{getRoleLabel(role)}</span>
                  </label>
                ))}
              </div>
            )}

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
                  <div className="flex items-center justify-between">
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
                    <div className="flex gap-2">
                      <Button size="sm" variant="outline" className="h-8 text-xs"
                        disabled={saving || !isDirty}
                        onClick={() => handleSaveAccessEmail(barber.id)}>
                        Guardar email
                      </Button>
                      <Button size="sm" className="h-8 text-xs"
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
                      <div className="flex items-center justify-between gap-2">
                        <div className="text-xs">
                          <div><span className="text-muted-foreground">Email:</span> <span className="font-mono">{code.email}</span></div>
                          <div><span className="text-muted-foreground">Contraseña temporal:</span> <span className="font-mono font-semibold">{code.password}</span></div>
                        </div>
                        <div className="flex gap-1">
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
                  roles: assignableRoles.length > 0 ? assignableRoles : ['barber'],
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
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-base font-medium">Equipo</CardTitle>
          {!isAdding && !editingId && activeSubTab === 'active' && (
            <Button variant="outline" size="sm" onClick={() => setIsAdding(true)}>
              <Plus className="h-4 w-4 mr-1" /> Agregar
            </Button>
          )}
        </CardHeader>
        <CardContent className="space-y-4">
          <Tabs value={activeSubTab} onValueChange={(v) => setActiveSubTab(v as 'active' | 'inactive')}>
            <TabsList className="w-full h-9 bg-muted/50 p-1 rounded-md">
              <TabsTrigger value="active" className="flex-1 text-xs data-[state=active]:bg-card">Activos ({activeBarbers.length})</TabsTrigger>
              <TabsTrigger value="inactive" className="flex-1 text-xs data-[state=active]:bg-card">Inactivos ({inactiveBarbers.length})</TabsTrigger>
            </TabsList>
            <TabsContent value="active" className="mt-4 space-y-3">
              {isAdding && (
                <StaffForm isEdit={false} initialData={formData} onSave={(data) => handleFormSave(data)} onCancel={cancelEdit} />
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
    </>
  );
}
