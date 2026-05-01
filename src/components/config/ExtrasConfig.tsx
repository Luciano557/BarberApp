import { useState } from 'react';
import { Plus, Edit2, Save, X, PowerOff, Power } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { CurrencyInput } from '@/components/ui/currency-input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Extra } from '@/types/barbershop';

interface ExtrasConfigProps {
  extras: Extra[];
  onAdd: (extra: Omit<Extra, 'id' | 'uid'>) => void;
  onUpdate: (id: string, updates: Partial<Extra>) => void;
  /**
   * 'global' = edita catálogo global (sin precio); usa globalActive para Activos/Inactivos.
   * 'sucursal' (default) = comportamiento histórico por sucursal.
   */
  mode?: 'global' | 'sucursal';
}

interface ToggleConfirm {
  extra: Extra;
  action: 'activate' | 'deactivate';
}

export function ExtrasConfig({ extras, onAdd, onUpdate, mode = 'sucursal' }: ExtrasConfigProps) {
  const isGlobal = mode === 'global';
  const [isAdding, setIsAdding] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [newName, setNewName] = useState('');
  const [newPrice, setNewPrice] = useState('');
  const [activeSubTab, setActiveSubTab] = useState<'active' | 'inactive'>('active');
  const [toggleConfirm, setToggleConfirm] = useState<ToggleConfirm | null>(null);

  const flagFor = (e: Extra) => isGlobal ? (e.globalActive ?? e.active) : e.active;
  const activeExtras = extras.filter(e => flagFor(e));
  const inactiveExtras = extras.filter(e => !flagFor(e));

  const handleAdd = () => {
    if (!newName) return;
    if (!isGlobal && !newPrice) return;
    onAdd({ name: newName, price: isGlobal ? 0 : parseFloat(newPrice), active: true });
    setNewName(''); setNewPrice(''); setIsAdding(false);
  };

  const handleUpdate = (id: string) => {
    if (!newName) return;
    if (!isGlobal && !newPrice) return;
    const updates: Partial<Extra> = { name: newName };
    if (!isGlobal) updates.price = parseFloat(newPrice);
    onUpdate(id, updates);
    setEditingId(null); setNewName(''); setNewPrice('');
  };

  const startEdit = (extra: Extra) => {
    setEditingId(extra.id);
    setNewName(extra.name);
    setNewPrice(extra.price.toString());
  };

  const handleConfirmToggle = () => {
    if (!toggleConfirm) return;
    onUpdate(toggleConfirm.extra.id, { active: toggleConfirm.action === 'activate' });
    setToggleConfirm(null);
  };

  const renderExtraItem = (extra: Extra) => (
    <div key={extra.id} className="flex items-center gap-3 p-3 rounded-lg bg-muted/30 hover:bg-muted/50 transition-colors border border-transparent hover:border-border">
      {editingId === extra.id ? (
        <div className="flex gap-2 w-full">
          <Input value={newName} onChange={(e) => setNewName(e.target.value)} className="flex-1" />
          <CurrencyInput value={newPrice} onChange={setNewPrice} className="w-28" />
          <Button size="icon" onClick={() => handleUpdate(extra.id)} className="bg-success hover:bg-success/90"><Save className="h-4 w-4" /></Button>
          <Button size="icon" variant="ghost" onClick={() => setEditingId(null)}><X className="h-4 w-4" /></Button>
        </div>
      ) : (
        <>
          <span className="flex-1 font-medium text-foreground">{extra.name}</span>
          <span className="text-muted-foreground">${extra.price.toLocaleString()}</span>
          <Button size="icon" variant="ghost" onClick={() => startEdit(extra)} className="h-8 w-8">
            <Edit2 className="h-4 w-4" />
          </Button>
          <Button size="icon" variant="ghost" onClick={() => setToggleConfirm({ extra, action: extra.active ? 'deactivate' : 'activate' })} className="h-8 w-8" title={extra.active ? 'Desactivar' : 'Activar'}>
            {extra.active ? <PowerOff className="h-4 w-4 text-destructive" /> : <Power className="h-4 w-4 text-success" />}
          </Button>
        </>
      )}
    </div>
  );

  return (
    <>
      <Card className="border border-border bg-card">
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-base font-medium">Extras</CardTitle>
          {!isAdding && activeSubTab === 'active' && (
            <Button variant="outline" size="sm" onClick={() => setIsAdding(true)}>
              <Plus className="h-4 w-4 mr-1" /> Agregar
            </Button>
          )}
        </CardHeader>
        <CardContent className="space-y-4">
          <Tabs value={activeSubTab} onValueChange={(v) => setActiveSubTab(v as 'active' | 'inactive')}>
            <TabsList className="w-full h-9 bg-muted/50 p-1 rounded-md">
              <TabsTrigger value="active" className="flex-1 text-xs data-[state=active]:bg-card">Activos ({activeExtras.length})</TabsTrigger>
              <TabsTrigger value="inactive" className="flex-1 text-xs data-[state=active]:bg-card">Inactivos ({inactiveExtras.length})</TabsTrigger>
            </TabsList>
            <TabsContent value="active" className="mt-4 space-y-2">
              {isAdding && (
                <div className="flex gap-2 p-3 bg-muted/30 border border-border rounded-lg animate-scale-in">
                  <Input placeholder="Nombre" value={newName} onChange={(e) => setNewName(e.target.value)} className="flex-1" />
                  <CurrencyInput placeholder="Precio" value={newPrice} onChange={setNewPrice} className="w-28" />
                  <Button size="icon" onClick={handleAdd} className="bg-success hover:bg-success/90"><Save className="h-4 w-4" /></Button>
                  <Button size="icon" variant="ghost" onClick={() => setIsAdding(false)}><X className="h-4 w-4" /></Button>
                </div>
              )}
              {activeExtras.map(renderExtraItem)}
              {activeExtras.length === 0 && !isAdding && (
                <p className="text-sm text-muted-foreground text-center py-4">No hay extras activos</p>
              )}
            </TabsContent>
            <TabsContent value="inactive" className="mt-4 space-y-2">
              {inactiveExtras.map(renderExtraItem)}
              {inactiveExtras.length === 0 && (
                <p className="text-sm text-muted-foreground text-center py-4">No hay extras inactivos</p>
              )}
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>

      {/* Toggle confirmation dialog */}
      <AlertDialog open={!!toggleConfirm} onOpenChange={(open) => !open && setToggleConfirm(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {toggleConfirm?.action === 'deactivate' ? 'Desactivar extra' : 'Activar extra'}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {toggleConfirm?.action === 'deactivate'
                ? `¿Estás seguro de que querés desactivar "${toggleConfirm?.extra.name}"?`
                : `¿Querés volver a activar "${toggleConfirm?.extra.name}"?`}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleConfirmToggle}>
              {toggleConfirm?.action === 'deactivate' ? 'Desactivar' : 'Activar'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
