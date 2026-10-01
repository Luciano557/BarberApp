import { useFinanceDemo } from '@/contexts/FinanceDemoContext';
import { Button } from '@/components/ui/button';

export function FinanceDemoControl() {
  const demo = useFinanceDemo();
  return (
    <div className="mt-8 flex flex-col items-start gap-3 border-t border-border pt-6 sm:flex-row sm:items-center sm:justify-between">
      <p className="text-sm text-muted-foreground">Mostrá Finanzas con datos de ejemplo para grabar contenido.</p>
      <Button variant="outline" className="w-full shrink-0 sm:w-auto" onClick={() => {
        if (demo.active) demo.requestExit();
        else demo.activate();
      }}>
        {demo.active ? 'Desactivar datos ficticios' : 'Mostrar datos ficticios'}
      </Button>
    </div>
  );
}
