import { ReactNode } from 'react';
import { PinGateDialog } from './PinGateDialog';
import { usePinProtection } from '@/hooks/usePinProtection';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Lock, User } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface PinProtectedSectionProps {
  children: ReactNode;
  sectionName?: string;
}

export function PinProtectedSection({ children, sectionName = 'esta sección' }: PinProtectedSectionProps) {
  const { isUnlocked, requiresPin, unlockedBy, isLoading, validatePin, hasPin } = usePinProtection();

  // Show loading state
  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  // If no PIN is required (user doesn't have one or doesn't have permission), show content directly
  if (!requiresPin) {
    return <>{children}</>;
  }

  // If PIN is required but not unlocked, show dialog
  if (!isUnlocked) {
    return (
      <>
        <Card className="max-w-md mx-auto mt-12">
          <CardHeader className="text-center">
            <div className="mx-auto bg-primary/10 p-4 rounded-full w-fit mb-2">
              <Lock className="h-8 w-8 text-primary" />
            </div>
            <CardTitle>Sección protegida</CardTitle>
            <CardDescription>
              Ingresa tu PIN para acceder a {sectionName}
            </CardDescription>
          </CardHeader>
          <CardContent className="text-center">
            <p className="text-sm text-muted-foreground mb-4">
              Esta sección está protegida por PIN para mayor seguridad.
            </p>
          </CardContent>
        </Card>
        
        <PinGateDialog 
          open={true} 
          onValidate={validatePin} 
          sectionName={sectionName} 
        />
      </>
    );
  }

  // Unlocked - show content with unlock info
  return (
    <div className="space-y-4">
      {unlockedBy && (
        <div className="flex items-center justify-between bg-muted/50 rounded-lg px-4 py-2 text-sm">
          <div className="flex items-center gap-2 text-muted-foreground">
            <User className="h-4 w-4" />
            <span>Desbloqueado por: <strong className="text-foreground">{unlockedBy}</strong></span>
          </div>
        </div>
      )}
      {children}
    </div>
  );
}

// Export a lock button component for the sidebar
export function PinLockButton() {
  const { isUnlocked, lock, hasPin, requiresPin } = usePinProtection();

  if (!requiresPin || !isUnlocked) {
    return null;
  }

  return (
    <Button
      variant="ghost"
      size="sm"
      onClick={lock}
      className="gap-2 text-muted-foreground hover:text-foreground"
    >
      <Lock className="h-4 w-4" />
      Bloquear
    </Button>
  );
}
