import { useMemo, useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { SegmentedControl } from '@/components/ui/SegmentedControl';
import { EmptyState } from '@/components/ui/EmptyState';
import { Skeleton } from '@/components/ui/skeleton';
import { useDelayedVisible } from '@/hooks/useDelayedVisible';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ArrowLeft, Repeat } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useSucursal } from '@/contexts/SucursalContext';
import { useTareasRecurrentes, TareaRecurrente } from '@/hooks/useTareasRecurrentes';
import { Barber } from '@/types/barbershop';
import { RecurrenteCard } from './RecurrenteCard';
import { TareaRecurrenteFormDialog } from './TareaRecurrenteFormDialog';
import { CountdownConfirm } from '@/components/CountdownConfirm';

interface Props {
  barbers: Barber[];
  onClose?: () => void;
}

export function RecurrentesPanel({ barbers, onClose }: Props) {
  const { isOwner, isGeneralManager, isManager, isSucursalAccount } = useAuth();
  const { currentSucursal, sucursales } = useSucursal();
  const { recetas, isLoading, addReceta, updateReceta, toggleActivo, deleteReceta } = useTareasRecurrentes();
  const showSkeleton = useDelayedVisible(isLoading);

  const canManageTareas = isOwner || isGeneralManager || isManager;
  const canDelete = canManageTareas; // sucursal_account no tiene RLS de DELETE
  const showSucursalFilter = !currentSucursal && sucursales.length > 1;

  const [activeSubTab, setActiveSubTab] = useState<'active' | 'inactive'>('active');
  const [filtroSucursal, setFiltroSucursal] = useState<string>('todas');
  const [showForm, setShowForm] = useState(false);
  const [editingReceta, setEditingReceta] = useState<TareaRecurrente | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<TareaRecurrente | null>(null);

  const sucursalNombre = (id: string | null) =>
    id ? (sucursales.find(s => s.id === id)?.nombre ?? null) : null;

  const matchesSucursal = (r: TareaRecurrente) => {
    if (!showSucursalFilter || filtroSucursal === 'todas') return true;
    return r.sucursal_id === filtroSucursal;
  };

  const filtered = useMemo(() => recetas.filter(matchesSucursal), [recetas, filtroSucursal, showSucursalFilter]);
  const activas = filtered.filter(r => r.activo);
  const pausadas = filtered.filter(r => !r.activo);


  const handleEdit = (r: TareaRecurrente) => {
    setEditingReceta(r);
    setShowForm(true);
  };

  const handleToggle = (r: TareaRecurrente) => {
    toggleActivo.mutate({ id: r.id, activo: !r.activo });
  };

  const handleDelete = (r: TareaRecurrente) => {
    setConfirmDelete(r);
  };

  const confirmDeleteAction = () => {
    if (!confirmDelete) return;
    deleteReceta.mutate(confirmDelete.id);
    setConfirmDelete(null);
  };

  if (isLoading) {
    if (!showSkeleton) return null;
    return (
      <div className="space-y-4">
        <Skeleton className="h-9 w-56 sm:ml-auto sm:max-w-xs" />
        <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <Card key={i}>
              <CardContent className="p-4 space-y-3">
                <Skeleton className="h-4 w-2/3" />
                <Skeleton className="h-3 w-full" />
                <Skeleton className="h-3 w-1/3" />
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  const renderList = (list: TareaRecurrente[], emptyLabel: string, emptyHint: string) => {
    if (list.length === 0) {
      return (
        <Card>
          <CardContent className="py-12">
            <EmptyState icon={Repeat} title={emptyLabel} description={emptyHint} />
          </CardContent>
        </Card>
      );
    }
    return (
      <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-3">
        {list.map(r => (
          <RecurrenteCard
            key={r.id}
            receta={r}
            sucursalNombre={sucursalNombre(r.sucursal_id)}
            canManage={canManageTareas || isSucursalAccount}
            canDelete={canDelete}
            isSucursalAccount={isSucursalAccount}
            onEdit={handleEdit}
            onToggle={handleToggle}
            onDelete={handleDelete}
          />
        ))}
      </div>
    );
  };

  return (
    <div className="space-y-4">
      {showSucursalFilter && (
        <Select value={filtroSucursal} onValueChange={setFiltroSucursal}>
          <SelectTrigger className="w-[180px] h-9"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="todas">Todas las sucursales</SelectItem>
            {sucursales.map(s => <SelectItem key={s.id} value={s.id}>{s.nombre}</SelectItem>)}
          </SelectContent>
        </Select>
      )}

      <div className="flex flex-wrap items-center gap-3">
        {onClose && (
          <button
            type="button"
            onClick={onClose}
            className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            <ArrowLeft className="h-4 w-4" />Volver a tareas
          </button>
        )}

        <SegmentedControl
          ariaLabel="Estado de recurrencias"
          className="sm:ml-auto sm:max-w-xs"
          options={[
            { value: 'active', label: 'Activas', count: activas.length },
            { value: 'inactive', label: 'Pausadas', count: pausadas.length },
          ]}
          value={activeSubTab}
          onChange={(v) => setActiveSubTab(v as 'active' | 'inactive')}
        />
      </div>

      {activeSubTab === 'active' ? (
        <div role="tabpanel" aria-label="Recurrencias activas" className="mt-4">
          {renderList(
            activas,
            'No hay recurrencias activas',
            canManageTareas
              ? 'Creá una recurrencia para generar tareas automáticamente.'
              : 'Cuando se creen recurrencias, vas a poder verlas y gestionarlas acá.',
          )}
        </div>
      ) : (
        <div role="tabpanel" aria-label="Recurrencias pausadas" className="mt-4">
          {renderList(
            pausadas,
            'No hay recurrencias pausadas',
            'Las recurrencias pausadas dejan de generar tareas hasta que las reactives.',
          )}
        </div>
      )}

      <TareaRecurrenteFormDialog
        open={showForm}
        onOpenChange={(o) => { setShowForm(o); if (!o) setEditingReceta(null); }}
        barbers={barbers}
        receta={editingReceta}
        onSubmit={(data) => addReceta.mutate(data)}
        onUpdate={(patch) => updateReceta.mutate(patch)}
        isPending={addReceta.isPending || updateReceta.isPending}
      />

      <CountdownConfirm
        open={!!confirmDelete}
        onOpenChange={(o) => { if (!o) setConfirmDelete(null); }}
        onConfirm={confirmDeleteAction}
        title="Eliminar recurrencia"
        description="Se eliminará la recurrencia y todas las tareas futuras pendientes asociadas. Las tareas ya generadas en el pasado no se tocan. Esta acción no se puede deshacer."
      />
    </div>
  );
}
