import { useState } from 'react';
import { useResumenesMensuales } from '@/hooks/useResumenesMensuales';
import { useOnboarding } from '@/components/onboarding/OnboardingProvider';
import { ResumenMensualDialog } from './ResumenMensualDialog';

/**
 * Punto de montaje del resumen mensual automático.
 *
 * No renderiza nada salvo que el usuario sea owner/general_manager Y tenga al
 * menos un resumen sin leer y sin descartar. La carga es asincrónica y no
 * bloquea nada: la app se monta igual mientras se resuelve la consulta.
 */
export function ResumenMensualStory() {
  const { pendientes, isLoading, habilitado, marcarLeido, posponerTodos, descartarTodos } =
    useResumenesMensuales();
  const onboarding = useOnboarding();
  const [abierto, setAbierto] = useState(true);

  // El tour de onboarding tiene prioridad: enseñar la app antes que resumirla.
  // Si el tour está activo, el resumen queda pendiente para la próxima entrada.
  const debeMostrar = habilitado && !isLoading && pendientes.length > 0 && !onboarding.isActive;

  if (!debeMostrar) return null;

  return (
    <ResumenMensualDialog
      open={abierto}
      onOpenChange={setAbierto}
      resumenes={pendientes}
      onMarcarLeido={marcarLeido}
      onPosponerTodos={posponerTodos}
      onDescartarTodos={descartarTodos}
    />
  );
}
