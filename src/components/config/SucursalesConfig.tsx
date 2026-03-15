import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useOrganization } from '@/contexts/OrganizationContext';
import { useSucursal, Sucursal } from '@/contexts/SucursalContext';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { MapPin, Plus, Edit2, Trash2, Users, UserCheck } from 'lucide-react';
import { toast } from 'sonner';

interface UserProfile {
  id: string;
  email: string;
  full_name: string | null;
}

interface SucursalAssignment {
  user_id: string;
  sucursal_id: string;
}

export function SucursalesConfig() {
  const { organization } = useOrganization();
  const { sucursales, refreshSucursales } = useSucursal();
  const [allSucursales, setAllSucursales] = useState<Sucursal[]>([]);
  const [showDialog, setShowDialog] = useState(false);
  const [editingSucursal, setEditingSucursal] = useState<Sucursal | null>(null);
  const [formData, setFormData] = useState({ nombre: '', direccion: '', telefono: '' });
  const [isSaving, setIsSaving] = useState(false);

  // Encargados assignment
  const [showAssignDialog, setShowAssignDialog] = useState(false);
  const [assignSucursal, setAssignSucursal] = useState<Sucursal | null>(null);
  const [orgUsers, setOrgUsers] = useState<UserProfile[]>([]);
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
      .select('id, email, full_name')
      .eq('organization_id', organization.id);
    if (data) setOrgUsers(data);
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
  }, [organization?.id]);

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
          .update({
            nombre: formData.nombre.trim(),
            direccion: formData.direccion || null,
            telefono: formData.telefono || null,
          })
          .eq('id', editingSucursal.id);
        if (error) throw error;
        toast.success('Sucursal actualizada');
      } else {
        const { error } = await supabase
          .from('sucursales')
          .insert({
            organization_id: organization.id,
            nombre: formData.nombre.trim(),
            direccion: formData.direccion || null,
            telefono: formData.telefono || null,
            timezone: organization.timezone,
          });
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
    const { error } = await supabase
      .from('sucursales')
      .update({ activa: !suc.activa })
      .eq('id', suc.id);
    if (error) {
      toast.error('Error al actualizar');
    } else {
      toast.success(suc.activa ? 'Sucursal desactivada' : 'Sucursal activada');
      await fetchAllSucursales();
      await refreshSucursales();
    }
  };

  const handleOpenAssign = async (suc: Sucursal) => {
    setAssignSucursal(suc);
    await fetchAssignments(suc.id);
    setSelectedUserId('');
    setShowAssignDialog(true);
  };

  const handleAssignUser = async () => {
    if (!selectedUserId || !assignSucursal || !organization?.id) return;
    
    const { error } = await supabase
      .from('user_sucursales')
      .insert({
        user_id: selectedUserId,
        sucursal_id: assignSucursal.id,
        organization_id: organization.id,
      });

    if (error) {
      if (error.code === '23505') {
        toast.error('Este usuario ya está asignado a esta sucursal');
      } else {
        toast.error('Error al asignar');
      }
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

  const getAssignedUsers = () => {
    return assignments.map(a => {
      const user = orgUsers.find(u => u.id === a.user_id);
      return { userId: a.user_id, name: user?.full_name || user?.email || 'Desconocido' };
    });
  };

  const getUnassignedUsers = () => {
    const assignedIds = new Set(assignments.map(a => a.user_id));
    return orgUsers.filter(u => !assignedIds.has(u.id));
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          Gestioná las sucursales de tu negocio
        </p>
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
                    {suc.direccion && (
                      <p className="text-sm text-muted-foreground">{suc.direccion}</p>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant={suc.activa ? 'default' : 'secondary'}>
                    {suc.activa ? 'Activa' : 'Inactiva'}
                  </Badge>
                  <Button variant="ghost" size="icon" onClick={() => handleOpenAssign(suc)} title="Asignar usuarios">
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
              <Input
                value={formData.nombre}
                onChange={(e) => setFormData(prev => ({ ...prev, nombre: e.target.value }))}
                placeholder="Ej: Sucursal Centro"
              />
            </div>
            <div className="space-y-2">
              <Label>Dirección</Label>
              <Input
                value={formData.direccion}
                onChange={(e) => setFormData(prev => ({ ...prev, direccion: e.target.value }))}
                placeholder="Av. Corrientes 1234"
              />
            </div>
            <div className="space-y-2">
              <Label>Teléfono</Label>
              <Input
                value={formData.telefono}
                onChange={(e) => setFormData(prev => ({ ...prev, telefono: e.target.value }))}
                placeholder="+54 11 1234-5678"
              />
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

      {/* Assign Users Dialog */}
      <Dialog open={showAssignDialog} onOpenChange={setShowAssignDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Usuarios de {assignSucursal?.nombre}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            {/* Current assignments */}
            <div>
              <Label className="text-sm font-medium mb-2 block">Asignados</Label>
              {getAssignedUsers().length === 0 ? (
                <p className="text-sm text-muted-foreground">Sin usuarios asignados</p>
              ) : (
                <div className="space-y-2">
                  {getAssignedUsers().map((u) => (
                    <div key={u.userId} className="flex items-center justify-between p-2 rounded-lg bg-muted/50">
                      <div className="flex items-center gap-2">
                        <UserCheck className="h-4 w-4 text-primary" />
                        <span className="text-sm">{u.name}</span>
                      </div>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleRemoveAssignment(u.userId)}
                        className="h-7 w-7"
                      >
                        <Trash2 className="h-3 w-3 text-destructive" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Add user */}
            {getUnassignedUsers().length > 0 && (
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
                <Button onClick={handleAssignUser} disabled={!selectedUserId}>
                  Asignar
                </Button>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
