import { useFinanceDemo } from '@/contexts/FinanceDemoContext';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';

export function FinanceDemoExitDialog() {
  const demo = useFinanceDemo();
  return (
    <AlertDialog open={demo.exitPending} onOpenChange={open => { if (!open) demo.cancelExit(); }}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Se volverán a mostrar datos reales</AlertDialogTitle>
          <AlertDialogDescription>Al salir del modo ficticio, verás la información de tu negocio. Terminá la grabación antes de continuar.</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel onClick={demo.cancelExit}>Seguir con datos ficticios</AlertDialogCancel>
          <AlertDialogAction onClick={demo.confirmExit}>Salir y continuar</AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
