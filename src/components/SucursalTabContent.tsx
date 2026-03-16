import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { MapPin, Phone, Edit2, Save, X, Shield, UserCheck, Scissors, Trash2, Plus, Building2 } from 'lucide-react';
import { Sucursal } from '@/contexts/SucursalContext';
import { useOrganization } from '@/contexts/OrganizationContext';
import { AppRole } from '@/contexts/AuthContext';
import { Barber, Service, Extra, Discount, Line, getBarberDisplayName } from '@/types/barbershop';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { StaffConfig } from './config/StaffConfig';
import { CobrarConfig } from './config/CobrarConfig';

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

interface SucursalAssignment {
  user_id: string;
  sucursal_id: string;
}

const getRoleLabel = (role: AppRole) => {
  switch (role) {
    case 'owner': return 'Dueño';
    case 'general_manager': return 'Enc. General';
    case 'manager': return 'Enc. Local';
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

interface SucursalTabContentProps {
  sucursal: Sucursal;
  barbers: Barber[];
  allBarbers: Barber[];
  services: Service[];
  extras: Extra[];
  discounts: Discount[];
  lines: Line[];
  onAddBarber: (barber: Omit<Barber, 'id' | 'uid'>) => void;
  onUpdateBarber: (id: string, updates: Partial<Barber>) => void;
  onAddService: (service: Omit<Service, 'id' | 'uid'>) => void;
  onUpdateService: (id: string, updates: Partial<Service>) => void;
  onAddExtra: (extra: Omit<Extra, 'id' | 'uid'>) => void;
  onUpdateExtra: (id: string, updates: Partial<Extra>) => void;
  onAddDiscount: (discount: Omit<Discount, 'id'>) => void;
  onUpdateDiscount: (id: string, updates: Partial<Discount>) => void;
  onDeleteDiscount: (id: string) => void;
  onAddLine: (line: Omit<Line, 'id'>) => Promise<Line | null>;
  onUpdateLine: (id: string, updates: Partial<Line>) => void;
  onSucursalUpdated: () => void;
}

export function SucursalTabContent({
  sucursal, barbers, allBarbers,
  services, extras, discounts, lines,
  onAddBarber, onUpdateBarber,
  onAddService, onUpdateService,
  onAddExtra, onUpdateExtra,
  onAddDiscount, onUpdateDiscount, onDeleteDiscount,
  onAddLine, onUpdateLine,
  onSucursalUpdated,
}: SucursalTabContentProps) {
  const { organization } = useOrganization();

  // --- Info editing ---
  const [isEditingInfo, setIsEditingInfo] = useState(false);
  const [infoForm, setInfoForm] = useState({
    nombre: sucursal.nombre,
    direccion: sucursal.direccion || '',
    telefono: sucursal.telefono || '',
  });
  const [isSavingInfo, setIsSavingInfo] = useState(false);

  useEffect(() => {
    setInfoForm({
      nombre: sucursal.nombre,
      direccion: sucursal.direccion || '',
      telefono: sucursal.telefono || '',
    });
    setIsEditingInfo(false);
  }, [sucursal.id]);

  const handleSaveInfo = async () => {
    setIsSavingInfo(true);
    const { error } = await supabase
      .from('sucursales')
      .update({
        nombre: infoForm.nombre.trim(),
        direccion: infoForm.direccion || null,
        telefono: infoForm.telefono || null,
      })
      .eq('id', sucursal.id);
    if (error) {
      toast.error('Error al guardar');
    } else {
      toast.success('Sucursal actualizada');
      setIsEditingInfo(false);
      onSucursalUpdated();
    }
    setIsSavingInfo(false);
  };

  // --- Equipo (user assignments) ---
  const [orgUsers, setOrgUsers] = useState<UserProfile[]>([]);
  const [userRoles, setUserRoles] = useState<UserRole[]>([]);
  const [assignments, setAssignments] = useState<SucursalAssignment[]>([]);
  const [selectedUserId, setSelectedUserId] = useState('');

  const fetchOrgUsers = async () => {
    if (!organization?.id) return;
    const { data } = await supabase.from('profiles').select('id, email, full_name, barbero_id').eq('organization_id', organization.id);
    if (data) setOrgUsers(data);
  };

  const fetchUserRoles = async () => {
    const { data } = await supabase.from('user_roles').select('user_id, role');
    if (data) setUserRoles(data as UserRole[]);
  };

  const fetchAssignments = async () => {
    const { data } = await supabase.from('user_sucursales').select('user_id, sucursal_id').eq('sucursal_id', sucursal.id);
    if (data) setAssignments(data);
  };

  useEffect(() => {
    fetchOrgUsers();
    fetchUserRoles();
    fetchAssignments();
  }, [organization?.id, sucursal.id]);

  const handleAssignUser = async () => {
    if (!selectedUserId || !organization?.id) return;
    const { error } = await supabase.from('user_sucursales').insert({
      user_id: selectedUserId, sucursal_id: sucursal.id, organization_id: organization.id,
    });
    if (error) {
      toast.error(error.code === '23505' ? 'Ya está asignado' : 'Error al asignar');
    } else {
      toast.success('Usuario asignado');
      await fetchAssignments();
      setSelectedUserId('');
    }
  };

  const handleRemoveAssignment = async (userId: string) => {
    const { error } = await supabase.from('user_sucursales').delete().eq('user_id', userId).eq('sucursal_id', sucursal.id);
    if (error) toast.error('Error al remover');
    else { toast.success('Asignación removida'); await fetchAssignments(); }
  };

  const handleAssignRole = async (userId: string, role: AppRole) => {
    const { error } = await supabase.from('user_roles').insert({ user_id: userId, role });
    if (error) toast.error(error.code === '23505' ? 'Ya tiene ese rol' : 'Error');
    else { toast.success('Rol asignado'); await fetchUserRoles(); }
  };

  const handleRemoveRole = async (userId: string, role: AppRole) => {
    const { error } = await supabase.from('user_roles').delete().eq('user_id', userId).eq('role', role);
    if (error) toast.error('Error al quitar rol');
    else { toast.success('Rol removido'); await fetchUserRoles(); }
  };

  const handleLinkBarber = async (userId: string, barberoId: string | null) => {
    const { error } = await supabase.from('profiles').update({ barbero_id: barberoId === 'none' ? null : barberoId }).eq('id', userId);
    if (error) toast.error('Error al vincular barbero');
    else { toast.success(barberoId === 'none' ? 'Desvinculado' : 'Vinculado'); await fetchOrgUsers(); }
  };

  const getUserRoles = (userId: string): AppRole[] =>
    userRoles.filter(r => r.user_id === userId).map(r => r.role);

  const getAssignedUsers = () =>
    assignments.map(a => orgUsers.find(u => u.id === a.user_id) || { id: a.user_id, email: 'Desconocido', full_name: null, barbero_id: null });

  const getUnassignedUsers = () => {
    const assignedIds = new Set(assignments.map(a => a.user_id));
    return orgUsers.filter(u => !assignedIds.has(u.id));
  };

  return (
    <div className="space-y-6 mt-6">
      {/* Información de la sucursal */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                <Building2 className="w-5 h-5 text-primary" />
              </div>
              <CardTitle className="text-base">Información de la sucursal</CardTitle>
            </div>
            {!isEditingInfo && (
              <Button variant="outline" size="sm" onClick={() => setIsEditingInfo(true)}>
                <Edit2 className="h-4 w-4 mr-1" /> Editar
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent>
          {isEditingInfo ? (
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Nombre</Label>
                <Input value={infoForm.nombre} onChange={(e) => setInfoForm(p => ({ ...p, nombre: e.target.value }))} />
              </div>
              <div className="space-y-2">
                <Label>Dirección</Label>
                <Input value={infoForm.direccion} onChange={(e) => setInfoForm(p => ({ ...p, direccion: e.target.value }))} placeholder="Av. Corrientes 1234" />
              </div>
              <div className="space-y-2">
                <Label>Teléfono</Label>
                <Input value={infoForm.telefono} onChange={(e) => setInfoForm(p => ({ ...p, telefono: e.target.value }))} placeholder="+54 11 1234-5678" />
              </div>
              <div className="flex gap-2 justify-end">
                <Button variant="ghost" size="sm" onClick={() => { setIsEditingInfo(false); setInfoForm({ nombre: sucursal.nombre, direccion: sucursal.direccion || '', telefono: sucursal.telefono || '' }); }} disabled={isSavingInfo}>
                  <X className="h-4 w-4 mr-1" /> Cancelar
                </Button>
                <Button size="sm" onClick={handleSaveInfo} disabled={isSavingInfo || !infoForm.nombre.trim()}>
                  <Save className="h-4 w-4 mr-1" /> {isSavingInfo ? 'Guardando...' : 'Guardar'}
                </Button>
              </div>
            </div>
          ) : (
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <Building2 className="w-4 h-4 text-muted-foreground" />
                <span className="font-medium">{sucursal.nombre}</span>
                <Badge variant={sucursal.activa ? 'default' : 'secondary'} className="ml-2">
                  {sucursal.activa ? 'Activa' : 'Inactiva'}
                </Badge>
              </div>
              {sucursal.direccion && (
                <div className="flex items-center gap-2">
                  <MapPin className="w-4 h-4 text-muted-foreground" />
                  <span className="text-sm">{sucursal.direccion}</span>
                </div>
              )}
              {sucursal.telefono && (
                <div className="flex items-center gap-2">
                  <Phone className="w-4 h-4 text-muted-foreground" />
                  <span className="text-sm">{sucursal.telefono}</span>
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Equipo - Usuarios asignados */}
      <div className="space-y-4">
        <h3 className="text-base font-medium text-foreground">Equipo</h3>

        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium">Usuarios asignados</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {getAssignedUsers().length === 0 ? (
              <p className="text-sm text-muted-foreground">Sin usuarios asignados</p>
            ) : (
              <div className="space-y-3">
                {getAssignedUsers().map((user) => {
                  const roles = getUserRoles(user.id);
                  const isOwnerUser = roles.includes('owner');
                  return (
                    <div key={user.id} className="p-3 rounded-lg border border-border space-y-3">
                      <div className="flex items-center justify-between">
                        <div className="min-w-0">
                          <p className="font-medium text-sm truncate">{user.full_name || 'Sin nombre'}</p>
                          <p className="text-xs text-muted-foreground truncate">{user.email}</p>
                        </div>
                        <Button variant="ghost" size="icon" className="h-7 w-7 shrink-0" onClick={() => handleRemoveAssignment(user.id)}>
                          <Trash2 className="h-3 w-3 text-destructive" />
                        </Button>
                      </div>
                      <div className="flex flex-wrap gap-1">
                        {roles.map(role => (
                          <Badge key={role} variant={getRoleBadgeVariant(role)} className="flex items-center gap-1 text-xs">
                            {getRoleIcon(role)} {getRoleLabel(role)}
                          </Badge>
                        ))}
                      </div>
                      {!isOwnerUser && (
                        <div className="flex flex-wrap gap-1.5">
                          {(['general_manager', 'manager', 'barber'] as AppRole[]).map(role => {
                            const hasRole = roles.includes(role);
                            return (
                              <Button key={role} variant={hasRole ? 'ghost' : 'outline'} size="sm" className="text-xs h-7"
                                onClick={() => hasRole ? handleRemoveRole(user.id, role) : handleAssignRole(user.id, role)}>
                                {hasRole ? '−' : '+'} {getRoleLabel(role)}
                              </Button>
                            );
                          })}
                        </div>
                      )}
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-muted-foreground whitespace-nowrap">Barbero:</span>
                        <Select value={user.barbero_id || 'none'} onValueChange={(v) => handleLinkBarber(user.id, v)}>
                          <SelectTrigger className="h-8 text-xs flex-1">
                            <SelectValue placeholder="Sin vincular" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="none">Sin vincular</SelectItem>
                            {allBarbers.map(b => (
                              <SelectItem key={b.id} value={b.id}>{getBarberDisplayName(b)}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {getUnassignedUsers().length > 0 && (
              <div className="pt-2">
                <Label className="text-sm font-medium mb-2 block">Agregar al equipo</Label>
                <div className="flex gap-2">
                  <Select value={selectedUserId} onValueChange={setSelectedUserId}>
                    <SelectTrigger className="flex-1">
                      <SelectValue placeholder="Seleccionar persona" />
                    </SelectTrigger>
                    <SelectContent>
                      {getUnassignedUsers().map(u => (
                        <SelectItem key={u.id} value={u.id}>{u.full_name || u.email}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Button onClick={handleAssignUser} disabled={!selectedUserId}>Agregar</Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Staff / Barberos */}
        <StaffConfig barbers={barbers} onAdd={onAddBarber} onUpdate={onUpdateBarber} />
      </div>

      {/* Cobrar */}
      <div className="space-y-4">
        <h3 className="text-base font-medium text-foreground">Cobrar</h3>
        <CobrarConfig
          services={services} extras={extras} discounts={discounts} lines={lines}
          onAddService={onAddService} onUpdateService={onUpdateService}
          onAddExtra={onAddExtra} onUpdateExtra={onUpdateExtra}
          onAddDiscount={onAddDiscount} onUpdateDiscount={onUpdateDiscount}
          onDeleteDiscount={onDeleteDiscount}
          onAddLine={onAddLine} onUpdateLine={onUpdateLine}
        />
      </div>
    </div>
  );
}
