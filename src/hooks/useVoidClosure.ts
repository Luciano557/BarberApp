import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { useRequirePinForAction } from '@/components/ActionPinGate';

export interface VoidClosureData {
  id: number;
  barberName: string;
  fechaCierre: string; // 'yyyy-MM-dd'
}

export const VOID_REASONS = [
  'Servicios duplicados o faltantes',
  'Se registraron ventas después del cierre',
  'Diferencia entre caja física y sistema detectada post-cierre',
  'Falla del sistema durante el cierre',
];

interface UseVoidClosureOptions {
  currentSucursalId: string | null;
  organizationId: string;
  userId: string;
  userFullName: string;
  userEmail: string;
  onSuccess: () => void;
}

export function useVoidClosure({
  currentSucursalId,
  organizationId,
  userId,
  userFullName,
  userEmail,
  onSuccess,
}: UseVoidClosureOptions) {
  const [voidingClosure, setVoidingClosure] = useState<VoidClosureData | null>(null);
  const [voidReason, setVoidReason] = useState('');
  const [isVoiding, setIsVoiding] = useState(false);
  const requirePinForAction = useRequirePinForAction();

  const executeVoidOp = async (closure: VoidClosureData, reason: string): Promise<boolean> => {
    setIsVoiding(true);
    try {
      const { error: updateError } = await supabase
        .from('ingresos')
        .update({ estado: 'eliminado' })
        .eq('id', closure.id);
      if (updateError) throw updateError;

      const { error: insertError } = await supabase
        .from('anulaciones_cierre')
        .insert({
          ingreso_id: closure.id,
          barbero_nombre: closure.barberName,
          fecha_cierre: closure.fechaCierre,
          anulado_por_id: userId,
          anulado_por_nombre: userFullName,
          anulado_por_email: userEmail,
          organization_id: organizationId,
          motivo: reason,
        });
      if (insertError) throw insertError;

      return true;
    } catch (error) {
      console.error('Error voiding closure:', error);
      toast.error('Error al anular el cierre de caja');
      return false;
    } finally {
      setIsVoiding(false);
    }
  };

  const handleVoidClosure = async () => {
    if (!voidingClosure || !voidReason) return;

    const gate = await requirePinForAction('anular_cierre_caja', currentSucursalId);
    if (!gate.ok) return;

    const ok = await executeVoidOp(voidingClosure, voidReason);
    if (!ok) return;

    toast.success('Cierre de caja anulado correctamente');
    setVoidingClosure(null);
    setVoidReason('');
    onSuccess();
  };

  // For automated flows (handleRegularize) — no dialog, reason is pre-resolved.
  // Returns true on success; caller is responsible for its own toast and refresh.
  const handleVoidClosureWithReason = async (
    closure: VoidClosureData,
    autoReason: string
  ): Promise<boolean> => {
    const gate = await requirePinForAction('anular_cierre_caja', currentSucursalId);
    if (!gate.ok) return false;
    return executeVoidOp(closure, autoReason);
  };

  return {
    voidingClosure,
    setVoidingClosure,
    voidReason,
    setVoidReason,
    handleVoidClosure,
    handleVoidClosureWithReason,
    isVoiding,
  };
}
