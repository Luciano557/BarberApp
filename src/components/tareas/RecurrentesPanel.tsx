import { useMemo, useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Plus, Repeat } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useSucursal } from '@/contexts/SucursalContext';
import { useTareasRecurrentes, TareaRecurrente } from '@/hooks/useTareasRecurrentes';
import { Barber } from '@/types/barbershop';
import { RecurrenteCard } from './RecurrenteCard';
import { TareaRecurrenteFormDialog } from './TareaRecurrenteFormDialog';
import { CountdownConfirm } from '@/components/CountdownConfirm';

interface Props {
  barbers: Barber[];
}

export function RecurrentesPanel({ barbers }: Props) {
  const { isOwner, isGeneralManager, isManager, isSucursalAccount } = useAuth();
  const { currentSucursal, sucursales } = useSucursal();
  const { recetas, isLoading, addReceta, updateReceta, toggleActivo, deleteReceta } = useTareasRecurrentes();

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

  const handleNueva = () => {
    setEditingReceta(null);
    setShowForm(true);
  };

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

  const EmptyState = ({ label, hint }: { label: string; hint: string }) => (
    <Card>
      <CardContent className="py-12 flex flex-col items-center justify-center gap-2 text-center">
        <div className="h-10 w-10 rounded-full bg-muted flex items-center justify-center">
          <Repeat className="h-5 w-5 text-muted-foreground" />
        </div>
        <p className="text-sm font-medium">{label}</p>
        <p className="text-xs text-muted-foreground max-w-xs">{hint}</p>
      </CardContent>
    </Card>
  );

  if (isLoading) {
    return <div className="text-center py-8 text-muted-foreground">Cargando...</div>;
  }

  const renderList = (list: TareaRecurrente[], emptyLabel: string, emptyHint: string) => {
    if (list.length === 0) {
      return <EmptyState label={emptyLabel} hint={emptyHint} />;
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
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div className="space-y-1">
          <p className="text-sm text-muted-foreground max-w-2xl">
            Recetas que generan tareas automáticamente en la frecuencia que definas.
          </p>
        </div>
        {canManageTareas && (
          <Button onClick={handleNueva} className="self-start sm:self-auto">
            <Plus className="h-4 w-4 mr-2" />Nueva recurrencia
          </Button>
        )}
      </div>

      {showSucursalFilter && (
        <Select value={filtroSucursal} onValueChange={setFiltroSucursal}>
          <SelectTrigger className="w-[180px] h-9"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="todas">Todas las sucursales</SelectItem>
            {sucursales.map(s => <SelectItem key={s.id} value={s.id}>{s.nombre}</SelectItem>)}
          </SelectContent>
        </Select>
      )}

      <Tabs value={activeSubTab} onValueChange={(v) => setActiveSubTab(v as 'active' | 'inactive')}>
        <TabsList className="w-full sm:w-auto h-9 bg-muted/50 p-1 rounded-md">
          <TabsTrigger value="active" className="flex-1 sm:flex-initial text-xs data-[state=active]:bg-card">
            Activas ({activas.length})
          </TabsTrigger>
          <TabsTrigger value="inactive" className="flex-1 sm:flex-initial text-xs data-[state=active]:bg-card">
            Pausadas ({pausadas.length})
          </TabsTrigger>
        </TabsList>

        <TabsContent value="active" className="mt-4">
          {renderList(
            activas,
            'No hay recurrencias activas',
            canManageTareas
              ? 'Creá una recurrencia para generar tareas automáticamente.'
              : 'Cuando se creen recurrencias, vas a poder verlas y gestionarlas acá.',
          )}
        </TabsContent>

        <TabsContent value="inactive" className="mt-4">
          {renderList(
            pausadas,
            'No hay recurrencias pausadas',
            'Las recurrencias pausadas dejan de generar tareas hasta que las reactives.',
          )}
        </TabsContent>
      </Tabs>

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
