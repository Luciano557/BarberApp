import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useOrganization } from '@/contexts/OrganizationContext';
import { useSucursal, Sucursal } from '@/contexts/SucursalContext';
import { useAuth, AppRole } from '@/contexts/AuthContext';
import { useSupabaseData } from '@/hooks/useSupabaseData';
import { getBarberDisplayName } from '@/types/barbershop';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { MapPin, Plus, Edit2, Trash2, Users, UserCheck, Shield, Scissors } from 'lucide-react';
import { toast } from 'sonner';

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
    case 'owner': return 'default';
    case 'general_manager': return 'default';
    case 'manager': return 'secondary';
    case 'barber': return 'outline';
  }
};

const getRoleIcon = (role: AppRole) => {
  switch (role) {
    case 'owner': return <Shield className="w-3 h-3" />;
    case 'general_manager': return <Shield className="w-3 h-3" />;
    case 'manager': return <UserCheck className="w-3 h-3" />;
    case 'barber': return <Scissors className="w-3 h-3" />;
  }
};

export function SucursalesConfig() {
  const { organization } = useOrganization();
  const { sucursales, refreshSucursales } = useSucursal();
  const { allBarbers } = useSupabaseData();
  const [allSucursales, setAllSucursales] = useState<Sucursal[]>([]);
  const [showDialog, setShowDialog] = useState(false);
  const [editingSucursal, setEditingSucursal] = useState<Sucursal | null>(null);
  const [formData, setFormData] = useState({ nombre: '', direccion: '', telefono: '' });
  const [isSaving, setIsSaving] = useState(false);

  // Users assignment dialog
  const [showAssignDialog, setShowAssignDialog] = useState(false);
  const [assignSucursal, setAssignSucursal] = useState<Sucursal | null>(null);
  const [orgUsers, setOrgUsers] = useState<UserProfile[]>([]);
  const [userRoles, setUserRoles] = useState<UserRole[]>([]);
  const [assignments, setAssignments] = useState<SucursalAssignment[]>([]);
  const [selectedUserId, setSelectedUserId] = useState('');

  const fetchAllSucursales = async () => {
    if (!organization?.id) return;
    const { data, error } = await supabase
      .from('sucursales')
      .select('*')
      .eq('organization_id', organization.id)
      .order('nombre');
    if (!error && data) {
      setAllSucursales(data.map(s => ({
        id: s.id,
        organization_id: s.organization_id,
        nombre: s.nombre,
        direccion: s.direccion,
        telefono: s.telefono,
        timezone: s.timezone,
        activa: s.activa,
      })));
    }
  };

  const fetchOrgUsers = async () => {
    if (!organization?.id) return;
    const { data } = await supabase
      .from('profiles')
      .select('id, email, full_name, barbero_id')
      .eq('organization_id', organization.id);
    if (data) setOrgUsers(data);
  };

  const fetchUserRoles = async () => {
    const { data } = await supabase
      .from('user_roles')
      .select('user_id, role');
    if (data) setUserRoles(data as UserRole[]);
  };

  const fetchAssignments = async (sucursalId: string) => {
    const { data } = await supabase
      .from('user_sucursales')
      .select('user_id, sucursal_id')
      .eq('sucursal_id', sucursalId);
    if (data) setAssignments(data);
  };

  useEffect(() => {
    fetchAllSucursales();
    fetchOrgUsers();
    fetchUserRoles();
  }, [organization?.id]);

  // --- Sucursal CRUD ---
  const handleOpenCreate = () => {
    setEditingSucursal(null);
    setFormData({ nombre: '', direccion: '', telefono: '' });
    setShowDialog(true);
  };

  const handleOpenEdit = (suc: Sucursal) => {
    setEditingSucursal(suc);
    setFormData({ nombre: suc.nombre, direccion: suc.direccion || '', telefono: suc.telefono || '' });
    setShowDialog(true);
  };

  const handleSave = async () => {
    if (!organization?.id || !formData.nombre.trim()) return;
    setIsSaving(true);
    try {
      if (editingSucursal) {
        const { error } = await supabase
          .from('sucursales')
          .update({ nombre: formData.nombre.trim(), direccion: formData.direccion || null, telefono: formData.telefono || null })
          .eq('id', editingSucursal.id);
        if (error) throw error;
        toast.success('Sucursal actualizada');
      } else {
        const { error } = await supabase
          .from('sucursales')
          .insert({ organization_id: organization.id, nombre: formData.nombre.trim(), direccion: formData.direccion || null, telefono: formData.telefono || null, timezone: organization.timezone });
        if (error) throw error;
        toast.success('Sucursal creada');
      }
      setShowDialog(false);
      await fetchAllSucursales();
      await refreshSucursales();
    } catch (error: any) {
      toast.error(error.message || 'Error al guardar');
    } finally {
      setIsSaving(false);
    }
  };

  const handleToggleActive = async (suc: Sucursal) => {
    const { error } = await supabase.from('sucursales').update({ activa: !suc.activa }).eq('id', suc.id);
    if (error) {
      toast.error('Error al actualizar');
    } else {
      toast.success(suc.activa ? 'Sucursal desactivada' : 'Sucursal activada');
      await fetchAllSucursales();
      await refreshSucursales();
    }
  };

  // --- User assignment ---
  const handleOpenAssign = async (suc: Sucursal) => {
    setAssignSucursal(suc);
    await Promise.all([fetchAssignments(suc.id), fetchOrgUsers(), fetchUserRoles()]);
    setSelectedUserId('');
    setShowAssignDialog(true);
  };

  const handleAssignUser = async () => {
    if (!selectedUserId || !assignSucursal || !organization?.id) return;
    const { error } = await supabase
      .from('user_sucursales')
      .insert({ user_id: selectedUserId, sucursal_id: assignSucursal.id, organization_id: organization.id });
    if (error) {
      toast.error(error.code === '23505' ? 'Ya está asignado' : 'Error al asignar');
    } else {
      toast.success('Usuario asignado');
      await fetchAssignments(assignSucursal.id);
      setSelectedUserId('');
    }
  };

  const handleRemoveAssignment = async (userId: string) => {
    if (!assignSucursal) return;
    const { error } = await supabase
      .from('user_sucursales')
      .delete()
      .eq('user_id', userId)
      .eq('sucursal_id', assignSucursal.id);
    if (error) {
      toast.error('Error al remover');
    } else {
      toast.success('Asignación removida');
      await fetchAssignments(assignSucursal.id);
    }
  };

  // --- Role management ---
  const handleAssignRole = async (userId: string, role: AppRole) => {
    const { error } = await supabase.from('user_roles').insert({ user_id: userId, role });
    if (error) {
      toast.error(error.code === '23505' ? 'Ya tiene ese rol' : 'Error al asignar rol');
      return;
    }
    toast.success('Rol asignado');
    await fetchUserRoles();
  };

  const handleRemoveRole = async (userId: string, role: AppRole) => {
    const { error } = await supabase.from('user_roles').delete().eq('user_id', userId).eq('role', role);
    if (error) {
      toast.error('Error al quitar rol');
      return;
    }
    toast.success('Rol removido');
    await fetchUserRoles();
  };

  // --- Barber linking ---
  const handleLinkBarber = async (userId: string, barberoId: string | null) => {
    const { error } = await supabase
      .from('profiles')
      .update({ barbero_id: barberoId === 'none' ? null : barberoId })
      .eq('id', userId);
    if (error) {
      toast.error('Error al vincular barbero');
      return;
    }
    toast.success(barberoId === 'none' ? 'Barbero desvinculado' : 'Barbero vinculado');
    await fetchOrgUsers();
  };

  const getUserRoles = (userId: string): AppRole[] =>
    userRoles.filter(r => r.user_id === userId).map(r => r.role);

  const getAssignedUsers = () =>
    assignments.map(a => {
      const user = orgUsers.find(u => u.id === a.user_id);
      return user || { id: a.user_id, email: 'Desconocido', full_name: null, barbero_id: null };
    });

  const getUnassignedUsers = () => {
    const assignedIds = new Set(assignments.map(a => a.user_id));
    return orgUsers.filter(u => !assignedIds.has(u.id));
  };

  // Filter barbers for this sucursal
  const sucursalBarbers = assignSucursal
    ? allBarbers.filter(b => b.sucursal_id === assignSucursal.id || !b.sucursal_id)
    : allBarbers;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">Gestioná las sucursales de tu negocio</p>
        <Button size="sm" onClick={handleOpenCreate}>
          <Plus className="h-4 w-4 mr-1" />
          Nueva sucursal
        </Button>
      </div>

      <div className="space-y-3">
        {allSucursales.map((suc) => (
          <Card key={suc.id} className={!suc.activa ? 'opacity-60' : ''}>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                    <MapPin className="h-5 w-5 text-primary" />
                  </div>
                  <div>
                    <p className="font-medium text-foreground">{suc.nombre}</p>
                    {suc.direccion && <p className="text-sm text-muted-foreground">{suc.direccion}</p>}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant={suc.activa ? 'default' : 'secondary'}>{suc.activa ? 'Activa' : 'Inactiva'}</Badge>
                  <Button variant="ghost" size="icon" onClick={() => handleOpenAssign(suc)} title="Usuarios y roles">
                    <Users className="h-4 w-4" />
                  </Button>
                  <Button variant="ghost" size="icon" onClick={() => handleOpenEdit(suc)}>
                    <Edit2 className="h-4 w-4" />
                  </Button>
                  <Button variant="ghost" size="icon" onClick={() => handleToggleActive(suc)}>
                    <Trash2 className="h-4 w-4 text-muted-foreground" />
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Create/Edit Dialog */}
      <Dialog open={showDialog} onOpenChange={setShowDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingSucursal ? 'Editar sucursal' : 'Nueva sucursal'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Nombre</Label>
              <Input value={formData.nombre} onChange={(e) => setFormData(prev => ({ ...prev, nombre: e.target.value }))} placeholder="Ej: Sucursal Centro" />
            </div>
            <div className="space-y-2">
              <Label>Dirección</Label>
              <Input value={formData.direccion} onChange={(e) => setFormData(prev => ({ ...prev, direccion: e.target.value }))} placeholder="Av. Corrientes 1234" />
            </div>
            <div className="space-y-2">
              <Label>Teléfono</Label>
              <Input value={formData.telefono} onChange={(e) => setFormData(prev => ({ ...prev, telefono: e.target.value }))} placeholder="+54 11 1234-5678" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setShowDialog(false)}>Cancelar</Button>
            <Button onClick={handleSave} disabled={isSaving || !formData.nombre.trim()}>
              {isSaving ? 'Guardando...' : 'Guardar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Users & Roles Dialog */}
      <Dialog open={showAssignDialog} onOpenChange={setShowAssignDialog}>
        <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Usuarios — {assignSucursal?.nombre}</DialogTitle>
          </DialogHeader>
          <div className="space-y-5">
            {/* Assigned users */}
            <div>
              <Label className="text-sm font-medium mb-2 block">Asignados</Label>
              {getAssignedUsers().length === 0 ? (
                <p className="text-sm text-muted-foreground">Sin usuarios asignados</p>
              ) : (
                <div className="space-y-3">
                  {getAssignedUsers().map((user) => {
                    const roles = getUserRoles(user.id);
                    const isOwnerUser = roles.includes('owner');
                    return (
                      <Card key={user.id} className="p-3">
                        <div className="space-y-3">
                          {/* User info & badges */}
                          <div className="flex items-center justify-between">
                            <div className="min-w-0">
                              <p className="font-medium text-sm truncate">{user.full_name || 'Sin nombre'}</p>
                              <p className="text-xs text-muted-foreground truncate">{user.email}</p>
                            </div>
                            <Button variant="ghost" size="icon" className="h-7 w-7 shrink-0" onClick={() => handleRemoveAssignment(user.id)}>
                              <Trash2 className="h-3 w-3 text-destructive" />
                            </Button>
                          </div>

                          {/* Roles */}
                          <div className="flex flex-wrap gap-1">
                            {roles.map(role => (
                              <Badge key={role} variant={getRoleBadgeVariant(role)} className="flex items-center gap-1 text-xs">
                                {getRoleIcon(role)}
                                {getRoleLabel(role)}
                              </Badge>
                            ))}
                          </div>

                          {/* Role actions (skip owner) */}
                          {!isOwnerUser && (
                            <div className="flex flex-wrap gap-1.5">
                              {(['general_manager', 'manager', 'barber'] as AppRole[]).map(role => {
                                const hasRole = roles.includes(role);
                                return (
                                  <Button
                                    key={role}
                                    variant={hasRole ? 'ghost' : 'outline'}
                                    size="sm"
                                    className="text-xs h-7"
                                    onClick={() => hasRole ? handleRemoveRole(user.id, role) : handleAssignRole(user.id, role)}
                                  >
                                    {hasRole ? '−' : '+'} {getRoleLabel(role)}
                                  </Button>
                                );
                              })}
                            </div>
                          )}

                          {/* Barber link */}
                          <div className="flex items-center gap-2">
                            <span className="text-xs text-muted-foreground whitespace-nowrap">Barbero:</span>
                            <Select
                              value={user.barbero_id || 'none'}
                              onValueChange={(value) => handleLinkBarber(user.id, value)}
                            >
                              <SelectTrigger className="h-8 text-xs flex-1">
                                <SelectValue placeholder="Sin vincular" />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="none">Sin vincular</SelectItem>
                                {sucursalBarbers.map(barber => (
                                  <SelectItem key={barber.id} value={barber.id}>
                                    {getBarberDisplayName(barber)}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                        </div>
                      </Card>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Add user */}
            {getUnassignedUsers().length > 0 && (
              <div>
                <Label className="text-sm font-medium mb-2 block">Agregar usuario</Label>
                <div className="flex gap-2">
                  <Select value={selectedUserId} onValueChange={setSelectedUserId}>
                    <SelectTrigger className="flex-1">
                      <SelectValue placeholder="Seleccionar usuario" />
                    </SelectTrigger>
                    <SelectContent>
                      {getUnassignedUsers().map((u) => (
                        <SelectItem key={u.id} value={u.id}>
                          {u.full_name || u.email}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Button onClick={handleAssignUser} disabled={!selectedUserId}>Asignar</Button>
                </div>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
