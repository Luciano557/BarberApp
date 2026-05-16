import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { NotificationsConfig } from './NotificationsConfig';
import { User as UserIcon, Mail, Bell } from 'lucide-react';

export function MiCuentaConfig() {
  const { profile, user } = useAuth();
  const displayName = profile?.full_name || user?.user_metadata?.full_name || '—';
  const email = profile?.email || user?.email || '—';

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <UserIcon className="h-4 w-4 text-muted-foreground" />
            Datos de la cuenta
          </CardTitle>
          <CardDescription>Información asociada a tu usuario</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex items-start gap-3">
            <UserIcon className="h-4 w-4 text-muted-foreground mt-0.5" />
            <div>
              <p className="text-xs text-muted-foreground">Nombre</p>
              <p className="text-sm text-foreground">{displayName}</p>
            </div>
          </div>
          <div className="flex items-start gap-3">
            <Mail className="h-4 w-4 text-muted-foreground mt-0.5" />
            <div>
              <p className="text-xs text-muted-foreground">Email</p>
              <p className="text-sm text-foreground break-all">{email}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Bell className="h-4 w-4 text-muted-foreground" />
            Notificaciones
          </CardTitle>
          <CardDescription>Personalizá qué avisos querés recibir</CardDescription>
        </CardHeader>
        <CardContent>
          <NotificationsConfig />
        </CardContent>
      </Card>
    </div>
  );
}
