import { useEffect } from 'react';
import { Wifi, WifiOff, RefreshCw, LogOut, Loader2, ExternalLink } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { useMercadoPago } from '@/hooks/useMercadoPago';
import { MpDevicesConfig } from './MpDevicesConfig';
import { useAuth } from '@/contexts/AuthContext';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';

export function MercadoPagoConnect() {
  const { isOwner, isGeneralManager } = useAuth();
  const canManage = isOwner || isGeneralManager;

  const {
    isConnected,
    mpUserId,
    expiresAt,
    isLoading,
    connect,
    disconnect,
    refreshConnection,
    devices,
    devicesLoading,
    syncDevices,
    assignDevice,
  } = useMercadoPago();

  // Auto-sync devices when connection is confirmed
  useEffect(() => {
    if (isConnected && devices.length === 0 && !devicesLoading) {
      syncDevices();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isConnected]);

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
            MercadoPago Point
          </CardTitle>
        </CardHeader>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {/* Connection Status Card */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-start justify-between gap-3">
            <div className="space-y-1">
              <CardTitle className="text-base flex items-center gap-2">
                {isConnected ? (
                  <Wifi className="h-4 w-4 text-green-600" />
                ) : (
                  <WifiOff className="h-4 w-4 text-muted-foreground" />
                )}
                MercadoPago Point
              </CardTitle>
              <CardDescription>
                {isConnected
                  ? 'Tu cuenta de MercadoPago está conectada. El sistema puede enviar cobros a tus terminales.'
                  : 'Conectá tu cuenta para cobrar con terminales Point directamente desde la app.'}
              </CardDescription>
            </div>
            <Badge variant={isConnected ? 'default' : 'secondary'} className="shrink-0">
              {isConnected ? 'Conectado' : 'Desconectado'}
            </Badge>
          </div>
        </CardHeader>

        <CardContent className="space-y-4">
          {isConnected && mpUserId && (
            <div className="rounded-md bg-muted/50 px-3 py-2 text-sm text-muted-foreground space-y-0.5">
              <p>
                <span className="font-medium text-foreground">Usuario MP:</span> {mpUserId}
              </p>
              {expiresAt && (
                <p>
                  <span className="font-medium text-foreground">Válido hasta:</span>{' '}
                  {expiresAt.toLocaleDateString('es-AR', { day: '2-digit', month: 'long', year: 'numeric' })}
                </p>
              )}
            </div>
          )}

          {canManage && (
            <div className="flex flex-wrap gap-2">
              {!isConnected ? (
                <Button onClick={connect} size="sm" className="gap-2">
                  <ExternalLink className="h-4 w-4" />
                  Conectar con MercadoPago
                </Button>
              ) : (
                <>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={refreshConnection}
                    className="gap-2"
                  >
                    <RefreshCw className="h-4 w-4" />
                    Verificar conexión
                  </Button>

                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button variant="outline" size="sm" className="gap-2 text-destructive hover:text-destructive">
                        <LogOut className="h-4 w-4" />
                        Desconectar
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>¿Desconectar MercadoPago?</AlertDialogTitle>
                        <AlertDialogDescription>
                          Se eliminarán las credenciales guardadas. Los cobros con terminal dejarán de
                          funcionar hasta que vuelvas a conectar tu cuenta.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Cancelar</AlertDialogCancel>
                        <AlertDialogAction
                          onClick={disconnect}
                          className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                        >
                          Desconectar
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Devices Section — only shown when connected */}
      {isConnected && (
        <>
          <Separator />
          <MpDevicesConfig
            devices={devices}
            devicesLoading={devicesLoading}
            onSync={syncDevices}
            onAssign={assignDevice}
            canManage={canManage}
          />
        </>
      )}
    </div>
  );
}
