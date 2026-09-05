import { useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card } from '@/components/ui/card';
import { PageHeader } from '@/components/ui/PageHeader';
import { Plus, Search, Users, MessageCircle, Upload } from 'lucide-react';
import { useSucursal } from '@/contexts/SucursalContext';
import { useClientes } from '@/hooks/useClientes';
import { SkeletonRow } from '@/components/ui/SkeletonRow';
import { useDelayedVisible } from '@/hooks/useDelayedVisible';
import { NuevoClienteDialog } from './clientes/NuevoClienteDialog';
import { ClienteDetailDialog } from './clientes/ClienteDetailDialog';
import { ImportClientesDialog } from './clientes/import/ImportClientesDialog';
import { toast } from 'sonner';
import { canonicalizePhoneAR } from '@/lib/phone';

export function ClientesPanel() {
  const { currentSucursal, isAllMode } = useSucursal();
  const { clientes, isLoading, error, refresh } = useClientes();
  const showSkeleton = useDelayedVisible(isLoading);

  const [search, setSearch] = useState('');
  const [showNuevo, setShowNuevo] = useState(false);
  const [showImport, setShowImport] = useState(false);
  const [selectedClienteId, setSelectedClienteId] = useState<string | null>(null);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return clientes;
    // Si parece teléfono (≥6 dígitos), tratamos con tolerancia: comparamos
    // dígitos contra dígitos y, si es convertible a AR, contra el canónico.
    const qDigits = q.replace(/\D/g, '');
    const looksLikePhone = qDigits.length >= 6;
    const qCanon = looksLikePhone ? canonicalizePhoneAR(q) : null;
    return clientes.filter(c => {
      const nameMatch =
        (c.nombre ?? '').toLowerCase().includes(q) ||
        (c.apellido ?? '').toLowerCase().includes(q) ||
        (c.email ?? '').toLowerCase().includes(q);
      if (nameMatch) return true;
      const phone = (c.telefono ?? '').toLowerCase();
      if (phone.includes(q)) return true;
      if (looksLikePhone) {
        const phoneDigits = phone.replace(/\D/g, '');
        if (phoneDigits && phoneDigits.includes(qDigits)) return true;
        if (qCanon && qCanon.ok && phone === qCanon.e164.toLowerCase()) return true;
      }
      return false;
    });
  }, [clientes, search]);

  const subtitle = isAllMode
    ? 'Gestioná la lista de clientes de todas las sucursales.'
    : 'Gestioná la lista de clientes de esta sucursal.';

  const handleImportClick = () => {
    setShowImport(true);
  };

  const handleWhatsappClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    toast('Próximamente');
  };

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <PageHeader
        title="Clientes"
        icon={Users}
        subtitle={subtitle}
        actions={(
          <>
            <Button variant="outline" onClick={handleImportClick}>
              <Upload className="h-4 w-4" />
              Importar clientes
            </Button>
            <Button onClick={() => setShowNuevo(true)}>
              <Plus className="h-4 w-4" />
              Nuevo cliente
            </Button>
          </>
        )}
        actionsLayout="inline"
      />

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Buscar por nombre, apellido, teléfono o email"
          className="pl-9"
        />
      </div>

      {/* Lista */}
      {isLoading ? (
        showSkeleton ? (
          <div className="space-y-2">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="rounded-xl border bg-card px-4 py-3">
                <SkeletonRow />
              </div>
            ))}
          </div>
        ) : null
      ) : error ? (
        <Card className="p-8 text-center">
          <p className="text-sm text-destructive">{error}</p>
        </Card>
      ) : clientes.length === 0 ? (
        <Card className="p-12 text-center">
          <div className="w-14 h-14 rounded-full bg-accent flex items-center justify-center mx-auto mb-4">
            <Users className="h-6 w-6 text-muted-foreground" />
          </div>
          <p className="text-sm font-medium mb-1">
            {isAllMode
              ? 'Todavía no hay clientes en la organización.'
              : 'Todavía no hay clientes en esta sucursal.'}
          </p>
          <p className="text-xs text-muted-foreground mb-4">
            Empezá creando tu primer cliente para llevar un registro.
          </p>
          <Button onClick={() => setShowNuevo(true)}>
            <Plus className="h-4 w-4" />
            Crear cliente
          </Button>
        </Card>
      ) : filtered.length === 0 ? (
        <Card className="p-8 text-center">
          <p className="text-sm text-muted-foreground">No se encontraron clientes que coincidan con "{search}".</p>
        </Card>
      ) : (
        <div className="space-y-2">
          {filtered.map(c => (
            <button
              key={c.id}
              onClick={() => setSelectedClienteId(c.id)}
              className="w-full text-left rounded-xl border bg-card hover:bg-accent transition-colors duration-150 px-4 py-3 flex items-center gap-3"
            >
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">
                  {c.nombre} {c.apellido}
                </p>
                <p className="text-xs text-muted-foreground truncate mt-0.5">
                  {c.telefono ? c.telefono : <span className="italic">Sin teléfono</span>}
                  {c.email ? ` · ${c.email}` : ''}
                </p>
              </div>
              <Button
                variant="ghost"
                size="icon"
                className="h-9 w-9 text-muted-foreground hover:text-foreground"
                onClick={handleWhatsappClick}
                title="WhatsApp (próximamente)"
              >
                <MessageCircle className="h-4 w-4" />
              </Button>
            </button>
          ))}
        </div>
      )}

      <NuevoClienteDialog
        open={showNuevo}
        onOpenChange={setShowNuevo}
        onCreated={(id) => setSelectedClienteId(id)}
      />

      <ClienteDetailDialog
        clienteId={selectedClienteId}
        open={selectedClienteId !== null}
        onOpenChange={(o) => { if (!o) setSelectedClienteId(null); }}
      />

      <ImportClientesDialog
        open={showImport}
        onOpenChange={setShowImport}
        onImported={refresh}
      />
    </div>
  );
}
