import React, { useState, useEffect, useCallback } from 'react';
import { Plus, Edit2, Save, X, Lock, Mail, UserX, UserCheck, Shield, Scissors, ChevronDown } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Barber, getBarberDisplayName } from '@/types/barbershop';
import { AppRole } from '@/contexts/AuthContext';
import { InviteUserDialog } from '@/components/InviteUserDialog';
import { StaffPinDialog } from '@/components/StaffPinDialog';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

// --- Role utilities ---
const ROLE_HIERARCHY: Record<AppRole, number> = {
  owner: 0,
  general_manager: 1,
  manager: 2,
  barber: 3,
};

const getRoleLabel = (role: AppRole) => {
  switch (role) {
    case 'owner': return 'Dueño';
    case 'general_manager': return 'Encargado General';
    case 'manager': return 'Encargado de Sucursal';
    case 'barber': return 'Barbero';
  }
};

const getRoleBadgeVariant = (role: AppRole): 'default' | 'secondary' | 'outline' => {
  switch (role) {
    case 'owner': case 'general_manager': return 'default';
    case 'manager': return 'secondary';
    case 'barber': return 'outline';
  }
};

const getRoleIcon = (role: AppRole) => {
  switch (role) {
    case 'owner': case 'general_manager': return <Shield className="w-3 h-3" />;
    case 'manager': return <UserCheck className="w-3 h-3" />;
    case 'barber': return <Scissors className="w-3 h-3" />;
  }
};

const ASSIGNABLE_ROLES: AppRole[] = ['general_manager', 'manager', 'barber'];

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
  onAddBarber: (barber: Omit<Barber, 'id' | 'uid'>) => void;
  onUpdateBarber: (id: string, updates: Partial<Barber>) => void;
}

interface ToggleConfirm {
  barber: Barber;
  action: 'activate' | 'deactivate';
}

export function EquipoUnificado({
  sucursalId, organizationId, barbers, allBarbers, onAddBarber, onUpdateBarber,
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

  const [formData, setFormData] = useState({
    firstName: '', lastName: '', phone: '', commission: '40', address: '', dni: '', role: 'barber' as AppRole,
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

  useEffect(() => { fetchPinStatus(); }, [fetchPinStatus]);
  useEffect(() => { fetchOrgUsers(); fetchUserRoles(); }, [fetchOrgUsers, fetchUserRoles]);

  // Get linked user for a barber
  const getLinkedUser = (barberId: string): UserProfile | undefined =>
    orgUsers.find(u => u.barbero_id === barberId);

  // Get roles for a user
  const getUserRoles = (userId: string): AppRole[] =>
    userRoles.filter(r => r.user_id === userId).map(r => r.role);

  // Get the highest role for a barber (through linked user)
  const getBarberRole = (barber: Barber): AppRole | null => {
    const linkedUser = getLinkedUser(barber.id);
    if (!linkedUser) return null;
    const roles = getUserRoles(linkedUser.id);
    if (roles.length === 0) return null;
    return roles.sort((a, b) => ROLE_HIERARCHY[a] - ROLE_HIERARCHY[b])[0];
  };

  // Sort barbers by role hierarchy
  const sortByHierarchy = (list: Barber[]): Barber[] => {
    return [...list].sort((a, b) => {
      const roleA = getBarberRole(a);
      const roleB = getBarberRole(b);
      const hierarchyA = roleA ? ROLE_HIERARCHY[roleA] : 99;
      const hierarchyB = roleB ? ROLE_HIERARCHY[roleB] : 99;
      if (hierarchyA !== hierarchyB) return hierarchyA - hierarchyB;
      return a.firstName.localeCompare(b.firstName);
    });
  };

  // Role change handler
  const handleChangeRole = async (barberId: string, newRole: AppRole) => {
    const linkedUser = getLinkedUser(barberId);
    if (!linkedUser) {
      toast.error('Este miembro no tiene un usuario vinculado. Invitalo primero.');
      return;
    }

    const currentRoles = getUserRoles(linkedUser.id);
    const isOwner = currentRoles.includes('owner');
    if (isOwner) {
      toast.error('No se puede cambiar el cargo del dueño');
      return;
    }

    // Remove all non-owner roles, then add new one
    for (const role of currentRoles.filter(r => r !== 'owner')) {
      await supabase.from('user_roles').delete().eq('user_id', linkedUser.id).eq('role', role);
    }
    const { error } = await supabase.from('user_roles').insert({ user_id: linkedUser.id, role: newRole });
    if (error) {
      toast.error('Error al cambiar cargo');
    } else {
      toast.success(`Cargo actualizado a ${getRoleLabel(newRole)}`);
      await fetchUserRoles();
    }
  };

  // Assign role to a new barber (no linked user yet - we just store it for when they get invited)
  const handleAssignRoleToNewBarber = async (barberId: string, role: AppRole) => {
    const linkedUser = getLinkedUser(barberId);
    if (!linkedUser) {
      toast.info('El cargo se asignará cuando el miembro sea invitado al sistema.');
      return;
    }
    await handleChangeRole(barberId, role);
  };

  const resetForm = () => {
    setFormData({ firstName: '', lastName: '', phone: '', commission: '40', address: '', dni: '', role: 'barber' });
  };

  const cancelEdit = () => { setEditingId(null); setIsAdding(false); resetForm(); };

  const handleFormSave = async (data: typeof formData, barberId?: string) => {
    if (barberId) {
      onUpdateBarber(barberId, {
        firstName: data.firstName, lastName: data.lastName, phone: data.phone,
        commission: Number(data.commission), address: data.address || undefined, dni: data.dni || undefined,
      });
      // Update role if linked user exists
      const linkedUser = getLinkedUser(barberId);
      if (linkedUser) {
        await handleChangeRole(barberId, data.role);
      }
      setEditingId(null);
    } else {
      onAddBarber({
        firstName: data.firstName, lastName: data.lastName, phone: data.phone,
        commission: Number(data.commission), address: data.address || undefined, dni: data.dni || undefined, active: true,
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

    const commissionRequired = localData.role === 'barber';

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
      if (commissionRequired && !localData.commission) return;
      if (!validateLocalCommission(localData.commission)) return;
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
          <div>
            <Input type="text" inputMode="numeric" placeholder={commissionRequired ? 'Comisión % *' : 'Comisión % (opcional)'} value={localData.commission}
              onChange={(e) => { setLocalData(prev => ({ ...prev, commission: e.target.value })); if (e.target.value) validateLocalCommission(e.target.value); }}
              onBlur={() => validateLocalCommission(localData.commission)}
              className={localCommissionError ? 'border-destructive' : ''} autoComplete="off" />
            {localCommissionError && <p className="text-xs text-destructive mt-1">{localCommissionError}</p>}
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Input placeholder="Dirección (opcional)" value={localData.address} onChange={(e) => setLocalData(prev => ({ ...prev, address: e.target.value }))} autoComplete="off" name="staff-address-field" />
          <Input placeholder="DNI (opcional)" value={localData.dni} onChange={(e) => setLocalData(prev => ({ ...prev, dni: e.target.value }))} autoComplete="off" />
        </div>
        {/* Role selector */}
        <div className="space-y-1.5">
          <label className="text-xs font-medium text-muted-foreground">Cargo *</label>
          <Select value={localData.role} onValueChange={(v) => setLocalData(prev => ({ ...prev, role: v as AppRole }))}>
            <SelectTrigger className="w-full">
              <SelectValue placeholder="Seleccionar cargo" />
            </SelectTrigger>
            <SelectContent>
              {ASSIGNABLE_ROLES.map(role => (
                <SelectItem key={role} value={role}>
                  <span className="flex items-center gap-2">
                    {getRoleIcon(role)} {getRoleLabel(role)}
                  </span>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="flex justify-end gap-2">
          <Button variant="ghost" size="sm" onClick={onCancel}><X className="h-4 w-4 mr-1" /> Cancelar</Button>
          <Button size="sm" onClick={handleSubmit} className="bg-success hover:bg-success/90"
            disabled={!localData.firstName || !localData.lastName || !localData.phone || (commissionRequired && !localData.commission) || !!localCommissionError}>
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
    const highestRole = getBarberRole(barber);
    const isOwner = roles.includes('owner');

    return (
      <div key={barber.id}>
        {editingId === barber.id ? (
          <StaffForm isEdit={true} barberId={barber.id}
            initialData={{
              firstName: barber.firstName, lastName: barber.lastName, phone: barber.phone,
              commission: String(barber.commission), address: barber.address || '', dni: barber.dni || '',
              role: highestRole || 'barber',
            }}
            onSave={(data) => handleFormSave(data, barber.id)} onCancel={cancelEdit} />
        ) : (
          <div className="p-4 rounded-lg bg-muted/30 hover:bg-muted/50 transition-colors border border-transparent hover:border-border">
            {/* Header: Name + Role + Commission */}
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-medium text-foreground">{barber.firstName} {barber.lastName}</span>
                {highestRole && (
                  <Badge variant={getRoleBadgeVariant(highestRole)} className="flex items-center gap-1 text-xs">
                    {getRoleIcon(highestRole)} {getRoleLabel(highestRole)}
                  </Badge>
                )}
                {!highestRole && (
                  <Badge variant="outline" className="text-xs text-muted-foreground">Sin cargo asignado</Badge>
                )}
                <span className="text-xs px-2 py-0.5 rounded bg-primary/10 text-primary">{barber.commission}% comisión</span>
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

            {/* Role selector (only for non-owners with linked users) */}
            {linkedUser && !isOwner && (
              <div className="flex items-center gap-2 mb-3">
                <span className="text-xs text-muted-foreground whitespace-nowrap">Cargo:</span>
                <Select value={highestRole || ''} onValueChange={(v) => handleChangeRole(barber.id, v as AppRole)}>
                  <SelectTrigger className="h-8 text-xs flex-1 max-w-[220px]">
                    <SelectValue placeholder="Seleccionar cargo" />
                  </SelectTrigger>
                  <SelectContent>
                    {ASSIGNABLE_ROLES.map(role => (
                      <SelectItem key={role} value={role}>{getRoleLabel(role)}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            {/* Actions with text labels */}
            <div className="flex flex-wrap gap-2 pt-2 border-t border-border">
              <Button variant="ghost" size="sm" className="h-8 text-xs" onClick={() => {
                setEditingId(barber.id);
                setFormData({
                  firstName: barber.firstName, lastName: barber.lastName, phone: barber.phone,
                  commission: String(barber.commission), address: barber.address || '', dni: barber.dni || '',
                  role: highestRole || 'barber',
                });
              }}>
                <Edit2 className="h-3.5 w-3.5 mr-1" /> Editar
              </Button>

              <Button variant="ghost" size="sm" className={`h-8 text-xs ${barberPinStatus[barber.id] ? 'text-primary' : ''}`}
                onClick={() => setPinDialogBarber(barber)}>
                <Lock className="h-3.5 w-3.5 mr-1" /> {barberPinStatus[barber.id] ? 'Editar PIN' : 'Configurar PIN'}
              </Button>

              <Button variant="ghost" size="sm" className="h-8 text-xs"
                onClick={() => setInviteBarber(barber)}>
                <Mail className="h-3.5 w-3.5 mr-1" /> Invitar
              </Button>

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
      <InviteUserDialog open={!!inviteBarber} onOpenChange={(open) => !open && setInviteBarber(null)} barber={inviteBarber || undefined} />
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
