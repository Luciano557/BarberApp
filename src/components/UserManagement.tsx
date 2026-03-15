import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth, AppRole } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Barber, getBarberDisplayName } from '@/types/barbershop';
import { toast } from 'sonner';
import { Users, Shield, UserCheck, Scissors } from 'lucide-react';

interface UserWithRoles {
  id: string;
  email: string;
  full_name: string | null;
  barbero_id: string | null;
  roles: AppRole[];
}

interface UserManagementProps {
  barbers: Barber[];
}

export function UserManagement({ barbers }: UserManagementProps) {
  const { canManageUsers } = useAuth();
  const [users, setUsers] = useState<UserWithRoles[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const fetchUsers = async () => {
    setIsLoading(true);
    
    // Fetch all profiles (only owner can do this via RLS)
    const { data: profiles, error: profilesError } = await supabase
      .from('profiles')
      .select('*');

    if (profilesError) {
      console.error('Error fetching profiles:', profilesError);
      toast.error('Error al cargar usuarios');
      setIsLoading(false);
      return;
    }

    // Fetch all roles
    const { data: roles, error: rolesError } = await supabase
      .from('user_roles')
      .select('*');

    if (rolesError) {
      console.error('Error fetching roles:', rolesError);
    }

    // Combine profiles with roles
    const usersWithRoles: UserWithRoles[] = (profiles || []).map(profile => ({
      id: profile.id,
      email: profile.email,
      full_name: profile.full_name,
      barbero_id: profile.barbero_id,
      roles: (roles || [])
        .filter(r => r.user_id === profile.id)
        .map(r => r.role as AppRole)
    }));

    setUsers(usersWithRoles);
    setIsLoading(false);
  };

  useEffect(() => {
    if (canManageUsers) {
      fetchUsers();
    }
  }, [canManageUsers]);

  const handleAssignRole = async (userId: string, role: AppRole) => {
    const { error } = await supabase
      .from('user_roles')
      .insert({ user_id: userId, role });

    if (error) {
      if (error.code === '23505') {
        toast.error('El usuario ya tiene ese rol');
      } else {
        toast.error('Error al asignar rol');
      }
      return;
    }

    toast.success('Rol asignado correctamente');
    fetchUsers();
  };

  const handleRemoveRole = async (userId: string, role: AppRole) => {
    const { error } = await supabase
      .from('user_roles')
      .delete()
      .eq('user_id', userId)
      .eq('role', role);

    if (error) {
      toast.error('Error al quitar rol');
      return;
    }

    toast.success('Rol removido correctamente');
    fetchUsers();
  };

  const handleLinkBarber = async (userId: string, barberoId: string | null) => {
    const { error } = await supabase
      .from('profiles')
      .update({ barbero_id: barberoId === 'none' ? null : barberoId })
      .eq('id', userId);

    if (error) {
      toast.error('Error al vincular barbero');
      return;
    }

    toast.success(barberoId === 'none' ? 'Barbero desvinculado' : 'Barbero vinculado correctamente');
    fetchUsers();
  };

  const getRoleBadgeVariant = (role: AppRole) => {
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

  const getRoleLabel = (role: AppRole) => {
    switch (role) {
      case 'owner': return 'Dueño';
      case 'general_manager': return 'Enc. General';
      case 'manager': return 'Enc. Local';
      case 'barber': return 'Barbero';
    }
  };

  if (!canManageUsers) {
    return null;
  }

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="w-5 h-5" />
            Gestión de Usuarios
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8 text-muted-foreground">
            Cargando usuarios...
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Users className="w-5 h-5" />
          Gestión de Usuarios
        </CardTitle>
        <CardDescription>
          Administrá los roles y permisos de los usuarios del sistema
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {users.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            No hay usuarios registrados
          </div>
        ) : (
          users.map(user => (
            <Card key={user.id} className="p-4">
              <div className="flex flex-col gap-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium">{user.full_name || 'Sin nombre'}</p>
                    <p className="text-sm text-muted-foreground">{user.email}</p>
                  </div>
                  <div className="flex gap-1">
                    {user.roles.map(role => (
                      <Badge 
                        key={role} 
                        variant={getRoleBadgeVariant(role)}
                        className="flex items-center gap-1"
                      >
                        {getRoleIcon(role)}
                        {getRoleLabel(role)}
                      </Badge>
                    ))}
                  </div>
                </div>

                <div className="flex flex-wrap gap-2 items-center">
                  {/* Assign roles */}
                  {!user.roles.includes('owner') && (
                    <>
                      {!user.roles.includes('manager') && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleAssignRole(user.id, 'manager')}
                        >
                          + Encargado
                        </Button>
                      )}
                      {user.roles.includes('manager') && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleRemoveRole(user.id, 'manager')}
                        >
                          - Encargado
                        </Button>
                      )}
                      {!user.roles.includes('barber') && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleAssignRole(user.id, 'barber')}
                        >
                          + Barbero
                        </Button>
                      )}
                      {user.roles.includes('barber') && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleRemoveRole(user.id, 'barber')}
                        >
                          - Barbero
                        </Button>
                      )}
                    </>
                  )}

                  {/* Link to barber */}
                  <div className="flex items-center gap-2 ml-auto">
                    <span className="text-sm text-muted-foreground">Vincular a:</span>
                    <Select
                      value={user.barbero_id || 'none'}
                      onValueChange={(value) => handleLinkBarber(user.id, value)}
                    >
                      <SelectTrigger className="w-[180px]">
                        <SelectValue placeholder="Seleccionar barbero" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">Sin vincular</SelectItem>
                        {barbers.map(barber => (
                          <SelectItem key={barber.id} value={barber.id}>
                            {getBarberDisplayName(barber)}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </div>
            </Card>
          ))
        )}
      </CardContent>
    </Card>
  );
}
